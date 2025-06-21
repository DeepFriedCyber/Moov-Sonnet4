import { Bed, Bath, MapPin, Heart } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface Property {
    id: string
    title: string
    price: number
    bedrooms: number
    bathrooms: number
    location: {
        area: string
        postcode: string
        lat: number
        lng: number
    }
    images: string[]
    propertyType: string
    description: string
}

interface PropertyCardProps {
    property: Property
}

export function PropertyCard({ property }: PropertyCardProps) {
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price)
    }

    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            <div className="relative">
                <Image
                    src={property.images[0] || '/placeholder-property.jpg'}
                    alt={property.title}
                    width={400}
                    height={300}
                    className="w-full h-48 object-cover"
                />
                <button className="absolute top-4 right-4 p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                    <Heart className="w-5 h-5 text-gray-600" />
                </button>
                <div className="absolute bottom-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                    {property.propertyType}
                </div>
            </div>

            <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-semibold text-gray-900 line-clamp-2">
                        {property.title}
                    </h3>
                    <div className="text-2xl font-bold text-blue-600">
                        {formatPrice(property.price)}
                    </div>
                </div>

                <div className="flex items-center text-gray-600 mb-3">
                    <MapPin className="w-4 h-4 mr-1" />
                    <span className="text-sm">{property.location.area}, {property.location.postcode}</span>
                </div>

                <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center text-gray-600">
                        <Bed className="w-4 h-4 mr-1" />
                        <span className="text-sm">{property.bedrooms} bed{property.bedrooms !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                        <Bath className="w-4 h-4 mr-1" />
                        <span className="text-sm">{property.bathrooms} bath{property.bathrooms !== 1 ? 's' : ''}</span>
                    </div>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {property.description}
                </p>

                <Link
                    href={`/property/${property.id}`}
                    className="w-full bg-blue-600 text-white text-center py-2 rounded-lg hover:bg-blue-700 transition-colors block"
                >
                    View Details
                </Link>
            </div>
        </div>
    )
}