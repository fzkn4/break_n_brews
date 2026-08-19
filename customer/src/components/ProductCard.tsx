import { Ban, Heart, Plus } from 'lucide-react';
import SmartImage from './SmartImage';
import { describeItem, formatPrice, productImage, titleCase } from '../lib/catalog';
import type { Availability } from '../lib/catalog';
import type { MenuItem } from '../types';

interface ProductCardProps {
  item: MenuItem;
  availability: Availability;
  isFavorite: boolean;
  onOpen: (item: MenuItem) => void;
  onToggleFavorite: (id: number) => void;
}

export default function ProductCard({ item, availability, isFavorite, onOpen, onToggleFavorite }: ProductCardProps) {
  const orderable = availability.kind === 'ok' || availability.kind === 'low';

  return (
    <article className={`product-card${orderable ? '' : ' is-out'}`}>
      <div className="product-card__media">
        <SmartImage src={productImage(item)} alt={item.name} />

        {availability.kind === 'low' && (
          <span className="stock-pill stock-pill--low">Only {availability.left} left</span>
        )}
        {availability.kind === 'sold_out' && <span className="stock-pill stock-pill--out">Sold out</span>}
        {availability.kind === 'unavailable' && <span className="stock-pill stock-pill--out">Unavailable</span>}

        <button
          className="product-card__fav"
          onClick={() => onToggleFavorite(item.id)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remove ${item.name} from favourites` : `Save ${item.name} to favourites`}
        >
          <Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="product-card__body">
        <span className="product-card__category">{titleCase(item.category)}</span>
        <h3 className="product-card__name">{item.name}</h3>
        <p className="product-card__desc">{describeItem(item)}</p>

        <div className="product-card__foot">
          <span className="price">{formatPrice(item.price)}</span>
          <button
            className={`btn btn-sm ${orderable ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => onOpen(item)}
            disabled={!orderable}
          >
            {orderable ? <Plus size={15} /> : <Ban size={15} />}
            {orderable ? 'Add' : 'Sold out'}
          </button>
        </div>
      </div>
    </article>
  );
}
