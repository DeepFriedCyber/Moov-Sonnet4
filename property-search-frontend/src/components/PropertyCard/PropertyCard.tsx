import React, { useState, memo } from 'react';
import Image from 'next/image';
import { Heart, MapPin, Bed, Bath, Square } from 'lucide-react';
import { Property } from '@/types/property';
import { formatPrice } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PropertyCardProps {
    property: Property & { semanticScore?: number };
    onClick: (property: Property) => void;
    onFavorite: (propertyId: string) => void;
    showSemanticScore?: boolean;
    className?: string;
}

export const PropertyCard = memo(function PropertyCard({
    property,
    onClick,
    onFavorite,
    showSemanticScore = false,
    className,
}: PropertyCardProps) {
    const [isFavorited, setIsFavorited] = useState(false);
    const [imageError, setImageError] = useState(false);

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsFavorited(!isFavorited);
        onFavorite(property.id);
    };

    return (
        <article
            className={cn(
                'group cursor-pointer overflow-hidden rounded-lg bg-white shadow-md transition-all hover:shadow-xl',
                className
            )}
            onClick={() => onClick(property)}
            role="article"
            aria-label={`Property: ${property.title}`}
        >
            <div className="relative h-48 w-full overflow-hidden">
                {!imageError && property.images && property.images.length > 0 ? (
                    <Image
                        src={property.images[0] || '/placeholder-property.jpg'}
                        alt={property.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div
                        className="flex h-full items-center justify-center bg-gray-200"
                        data-testid="image-placeholder"
                    >
                        <Square className="h-12 w-12 text-gray-400" />
                    </div>
                )}

                <button
                    onClick={handleFavoriteClick}
                    className="absolute right-2 top-2 rounded-full bg-white/80 p-2 backdrop-blur-sm transition-colors hover:bg-white"
                    aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <Heart
                        className={cn(
                            'h-5 w-5 transition-colors',
                            isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-600'
                        )}
                    />
                </button>

                {showSemanticScore && property.semanticScore && (
                    <div className="absolute left-2 top-2 rounded-full bg-green-500 px-3 py-1 text-sm font-medium text-white">
                        {Math.round(property.semanticScore * 100)}% match
                    </div>
                )}
            </div>

            <div className="p-4">
                <h3 className="mb-2 text-lg font-semibold text-gray-900 line-clamp-1">
                    {property.title}
                </h3>

                <p className="mb-3 text-2xl font-bold text-gray-900">
                    {formatPrice(property.price)}
                </p>

                <div className="mb-3 flex items-center text-sm text-gray-600">
                    <MapPin className="mr-1 h-4 w-4" />
                    <span>{property.location.city}, {property.location.postcode}</span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                        <Bed className="mr-1 h-4 w-4" />
                        <span>{property.bedrooms} beds</span>
                    </div>
                    <div className="flex items-center">
                        <Bath className="mr-1 h-4 w-4" />
                        <span>{property.bathrooms} bath</span>
                    </div>
                    {property.squareFootage && (
                        <div className="flex items-center">
                            <Square className="mr-1 h-4 w-4" />
                            <span>{property.squareFootage} sq ft</span>
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
});