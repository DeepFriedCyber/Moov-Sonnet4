import { SearchBox } from '@/components/search/SearchBox'
import { PropertyCard } from '@/components/property/PropertyCard'
import { ChatWidget } from '@/components/chat/ChatWidget'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Find Your Perfect Home with
            <span className="text-blue-600"> AI-Powered Search</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Search properties using natural language. Our AI understands what you're looking for 
            and finds homes that match your lifestyle, not just your filters.
          </p>
        </div>

        {/* Smart Search Box */}
        <div className="max-w-4xl mx-auto mb-16">
          <SearchBox />
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          {['Family homes with gardens', 'Modern flats near transport', 'Properties with parking', 'Homes near good schools'].map((filter) => (
            <button
              key={filter}
              className="px-6 py-3 bg-white border border-gray-200 rounded-full hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      {/* Featured Properties */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Featured Properties</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Sample properties - replace with real data */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <PropertyCard
              key={i}
              property={{
                id: `sample-${i}`,
                title: `Beautiful ${i + 2} Bedroom House`,
                price: 250000 + (i * 50000),
                bedrooms: i + 2,
                bathrooms: 2,
                location: {
                  area: 'Manchester',
                  postcode: 'M1 1AA',
                  lat: 53.4808,
                  lng: -2.2426
                },
                images: [`https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=300&fit=crop`],
                propertyType: 'House',
                description: `Stunning ${i + 2} bedroom property in a desirable location.`
              }}
            />
          ))}
        </div>
      </section>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  )
}
