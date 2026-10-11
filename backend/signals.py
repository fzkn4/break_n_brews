"""Outside signals for the AI sales insights: weather, public holidays and paydays.

Weather comes from Open-Meteo and holidays from Nager.Date. Both are free and need no API key.
Every fetch is cached in memory and fails soft: if a service is down, the insights run goes ahead
without that signal and says so instead of erroring.
"""
import json
import logging
import threading
import time
import urllib.parse
import urllib.request
from calendar import monthrange
from datetime import date, timedelta

log = logging.getLogger(__name__)

WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'
HOLIDAYS_URL = 'https://date.nager.at/api/v3/PublicHolidays/{year}/{country}'
WEATHER_TTL = 60 * 60
HOLIDAY_TTL = 24 * 60 * 60
TIMEOUT = 8
RAINY_MM = 5.0
HOT_FEELS_C = 33.0  # floor; "hot" is the hottest quarter of days, never cooler than this
MIN_DAYS_PER_GROUP = 4
MIN_CATEGORY_UNITS = 20  # below this, a category's daily counts are too small to compare
MIN_T_SCORE = 2.5  # strict, because every run compares many categories and conditions

# WMO weather interpretation codes, as used by Open-Meteo.
WMO = {
    0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Light showers', 81: 'Showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
}

_cache = {}
_cache_lock = threading.Lock()


def _get_json(url, ttl):
    now = time.time()
    with _cache_lock:
        hit = _cache.get(url)
        if hit and now - hit[0] < ttl:
            return hit[1]
    req = urllib.request.Request(url, headers={'User-Agent': 'BreakAndBrews/1.0 (sales insights)'})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        data = json.loads(res.read().decode('utf-8'))
    with _cache_lock:
        _cache[url] = (now, data)
    return data


def store_location(settings):
    if settings.latitude is None or settings.longitude is None:
        return None
    return {'name': settings.location_name or '', 'latitude': settings.latitude, 'longitude': settings.longitude}


def fetch_weather(settings, past_days=56, forecast_days=7):
    """Daily weather for the last `past_days` days and the next `forecast_days`. Returns (days, error)."""
    loc = store_location(settings)
    if not loc:
        return [], 'Store location is not set'
    params = {
        'latitude': f'{loc["latitude"]:.4f}',
        'longitude': f'{loc["longitude"]:.4f}',
        'daily': ','.join([
            'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max',
            'precipitation_sum', 'precipitation_probability_max',
        ]),
        'timezone': settings.timezone or 'auto',
        'past_days': min(max(past_days, 0), 92),
        'forecast_days': min(max(forecast_days, 1), 16),
    }
    try:
        data = _get_json(f'{WEATHER_URL}?{urllib.parse.urlencode(params)}', WEATHER_TTL)
        daily = data['daily']
    except Exception as exc:  # network, HTTP or shape errors all mean "no weather this run"
        log.warning('Weather fetch failed: %s', exc)
        return [], f'Weather service unavailable ({exc.__class__.__name__})'

    days = []
    for i, day in enumerate(daily.get('time', [])):
        def val(key):
            series = daily.get(key) or []
            return series[i] if i < len(series) else None
        code = val('weather_code')
        days.append({
            'date': day,
            'summary': WMO.get(code, 'Unknown') if code is not None else 'Unknown',
            'temp_max_c': val('temperature_2m_max'),
            'temp_min_c': val('temperature_2m_min'),
            'feels_like_max_c': val('apparent_temperature_max'),
            'rain_mm': val('precipitation_sum'),
            'rain_chance_pct': val('precipitation_probability_max'),
        })
    return days, None


def fetch_holidays(start, days, country='PH'):
    """Public holidays between start and start+days. Returns (holidays, error)."""
    end = start + timedelta(days=days)
    out, error = [], None
    for year in sorted({start.year, end.year}):
        try:
            for h in _get_json(HOLIDAYS_URL.format(year=year, country=country), HOLIDAY_TTL):
                d = date.fromisoformat(h['date'])
                if start <= d <= end:
                    out.append({'date': h['date'], 'name': h.get('localName') or h.get('name'),
                                'english_name': h.get('name'), 'nationwide': h.get('global', True)})
        except Exception as exc:
            log.warning('Holiday fetch failed: %s', exc)
            error = f'Holiday calendar unavailable ({exc.__class__.__name__})'
    return out, error


def calendar_days(start, days, holidays):
    """One row per upcoming day with weekday, holiday name and payday flag (15th and month end)."""
    by_date = {h['date']: h['name'] for h in holidays}
    rows = []
    for i in range(days):
        d = start + timedelta(days=i)
        last = monthrange(d.year, d.month)[1]
        rows.append({
            'date': d.isoformat(),
            'weekday': d.strftime('%A'),
            'holiday': by_date.get(d.isoformat()),
            'payday': d.day in (15, last),
            'weekend': d.weekday() >= 5,
        })
    return rows


def weather_effects(category_units_by_day, weather_days):
    """How each category's daily units differ on rainy and hot days, from the store's own history.

    Each day is first divided by the category's running average and its weekday pattern, so a wet
    stretch of slow Mondays, or a rainy month that happened while an item was fading, doesn't read
    as "rain hurts sales". An effect is reported only when both groups have enough days and the gap is
    unlikely to be noise; otherwise the AI is told nothing was measured and must not claim one.
    """
    # weather_days covers exactly the sales-history window, so a day missing from by_day sold zero.
    feels = sorted(w['feels_like_max_c'] for w in weather_days if w['feels_like_max_c'] is not None)
    hot_cutoff = max(HOT_FEELS_C, feels[int(len(feels) * 0.75)]) if feels else HOT_FEELS_C
    effects = []
    for category, by_day in category_units_by_day.items():
        rows = [(by_day.get(w['date'], 0.0), w, date.fromisoformat(w['date']).weekday()) for w in weather_days]
        if sum(u for u, _, _ in rows) < MIN_CATEGORY_UNITS:
            continue
        # Divide out the local trend (15-day running mean), then the weekday pattern.
        units = [u for u, _, _ in rows]
        detrended = []
        for i, (u, w, wd) in enumerate(rows):
            window = units[max(0, i - 7):i + 8]
            local = sum(window) / len(window)
            if local > 0:
                detrended.append((u / local, u, w, wd))
        by_wd = {}
        for ratio, _, _, wd in detrended:
            by_wd.setdefault(wd, []).append(ratio)
        wd_mean = {wd: sum(v) / len(v) for wd, v in by_wd.items()}
        adjusted = [(r / wd_mean[wd], u, w) for r, u, w, wd in detrended if wd_mean[wd] > 0]
        for label, test in (
            ('rainy', lambda w: (w['rain_mm'] or 0) >= RAINY_MM),
            ('hot', lambda w: (w['feels_like_max_c'] or 0) > hot_cutoff),
        ):
            yes = [a for a, _, w in adjusted if test(w)]
            no = [a for a, _, w in adjusted if not test(w)]
            if len(yes) < MIN_DAYS_PER_GROUP or len(no) < MIN_DAYS_PER_GROUP:
                continue
            ratio_yes, ratio_no = sum(yes) / len(yes), sum(no) / len(no)
            if not ratio_no or abs(_t_score(yes, no)) < MIN_T_SCORE:
                continue
            raw_yes = [u for _, u, w in adjusted if test(w)]
            raw_no = [u for _, u, w in adjusted if not test(w)]
            effects.append({
                'category': category,
                'condition': label,
                'avg_units_on_condition_days': round(sum(raw_yes) / len(raw_yes), 1),
                'avg_units_other_days': round(sum(raw_no) / len(raw_no), 1),
                'difference_pct': round((ratio_yes / ratio_no - 1) * 100, 1),
                'days_compared': [len(yes), len(no)],
                'definition': f'rain {RAINY_MM:g} mm or more' if label == 'rainy' else f'feels like above {hot_cutoff:g}°C',
            })
    effects.sort(key=lambda e: abs(e['difference_pct']), reverse=True)
    return effects


def _t_score(a, b):
    """Welch's t statistic: how many standard errors apart the two group means are."""
    def var(xs, m):
        return sum((x - m) ** 2 for x in xs) / (len(xs) - 1)
    ma, mb = sum(a) / len(a), sum(b) / len(b)
    se = (var(a, ma) / len(a) + var(b, mb) / len(b)) ** 0.5
    return (ma - mb) / se if se else 0.0


def gather(settings, forecast):
    """Weather (history + forecast), holidays, calendar and measured weather effects for one run."""
    today = date.fromisoformat(forecast['business_date'])
    horizon = forecast['horizon_days']
    weather, weather_error = fetch_weather(settings, past_days=max(forecast['history_days'], 1), forecast_days=horizon)
    holidays, holiday_error = fetch_holidays(today, horizon)
    upcoming = [w for w in weather if w['date'] >= today.isoformat()]
    past = [w for w in weather if w['date'] < today.isoformat()]
    return {
        'location': store_location(settings),
        'weather_forecast': upcoming,
        'weather_effects': weather_effects(forecast.get('_category_units_by_day', {}), past),
        'calendar': calendar_days(today, horizon, holidays),
        'holidays': holidays,
        'errors': [e for e in (weather_error, holiday_error) if e],
    }
