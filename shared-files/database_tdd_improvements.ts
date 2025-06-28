// Database Layer with TDD Approach

// property-search-api/src/models/Property.ts
import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../config/database'

interface PropertyAttributes {
  id: string
  title: string
  description?: string
  price: number
  location: string
  latitude?: number
  longitude?: number
  bedrooms?: number
  bathrooms?: number
  area?: number
  propertyType: 'apartment' | 'house' | 'studio' | 'commercial'
  images: string[]
  features: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface PropertyCreationAttributes extends Optional<PropertyAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Property extends Model<PropertyAttributes, PropertyCreationAttributes> 
  implements PropertyAttributes {
  public id!: string
  public title!: string
  public description?: string
  public price!: number
  public location!: string
  public latitude?: number
  public longitude?: number
  public bedrooms?: number
  public bathrooms?: number
  public area?: number
  public propertyType!: 'apartment' | 'house' | 'studio' | 'commercial'
  public images!: string[]
  public features!: string[]
  public isActive!: boolean
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  // Instance methods
  public async updatePriceHistory(newPrice: number): Promise<void> {
    // Implementation for price history tracking
  }

  public calculatePricePerSqFt(): number | null {
    return this.area ? Math.round(this.price / this.area) : null
  }

  // Static methods
  static async findByLocation(location: string, radius = 5): Promise<Property[]> {
    // Implementation for location-based search
    return this.findAll({
      where: sequelize.where(
        sequelize.fn('ST_DWithin',
          sequelize.col('location_point'),
          sequelize.fn('ST_GeogFromText', `POINT(${location})`),
          radius * 1000
        ),
        true
      )
    })
  }
}

Property.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [3, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  bedrooms: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 20
    }
  },
  bathrooms: {
    type: DataTypes.DECIMAL(3, 1),
    allowNull: true,
    validate: {
      min: 0,
      max: 20
    }
  },
  area: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1
    }
  },
  propertyType: {
    type: DataTypes.ENUM('apartment', 'house', 'studio', 'commercial'),
    allowNull: false,
    defaultValue: 'apartment'
  },
  images: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  features: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  sequelize,
  modelName: 'Property',
  tableName: 'properties',
  indexes: [
    { fields: ['price'] },
    { fields: ['location'] },
    { fields: ['bedrooms'] },
    { fields: ['propertyType'] },
    { fields: ['isActive'] },
    { fields: ['createdAt'] }
  ]
})

// Test file: property-search-api/src/tests/models/Property.test.ts
import { Property } from '../../models/Property'
import { sequelize } from '../../config/database'

describe('Property Model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true })
  })

  afterEach(async () => {
    await Property.destroy({ where: {} })
  })

  afterAll(async () => {
    await sequelize.close()
  })

  describe('Model Validation', () => {
    it('creates a valid property', async () => {
      const propertyData = {
        title: 'Test Property',
        price: 300000,
        location: 'London, UK',
        propertyType: 'apartment' as const,
        bedrooms: 2,
        bathrooms: 1,
        area: 850
      }

      const property = await Property.create(propertyData)
      
      expect(property.id).toBeDefined()
      expect(property.title).toBe(propertyData.title)
      expect(property.price).toBe(propertyData.price)
      expect(property.isActive).toBe(true)
    })

    it('validates required fields', async () => {
      await expect(Property.create({
        price: 300000,
        location: 'London'
        // Missing title
      } as any)).rejects.toThrow()
    })

    it('validates price is positive', async () => {
      await expect(Property.create({
        title: 'Test',
        price: -100,
        location: 'London',
        propertyType: 'apartment'
      })).rejects.toThrow()
    })

    it('validates bedroom count range', async () => {
      await expect(Property.create({
        title: 'Test',
        price: 300000,
        location: 'London',
        propertyType: 'apartment',
        bedrooms: 25 // Too many
      })).rejects.toThrow()
    })
  })

  describe('Instance Methods', () => {
    let property: Property

    beforeEach(async () => {
      property = await Property.create({
        title: 'Test Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment',
        area: 1000
      })
    })

    it('calculates price per square foot correctly', () => {
      const pricePerSqFt = property.calculatePricePerSqFt()
      expect(pricePerSqFt).toBe(300) // 300000 / 1000
    })

    it('returns null for price per sqft when area is missing', async () => {
      const propertyWithoutArea = await Property.create({
        title: 'No Area Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment'
      })
      
      expect(propertyWithoutArea.calculatePricePerSqFt()).toBeNull()
    })
  })

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test properties
      await Property.bulkCreate([
        {
          title: 'Central London Flat',
          price: 500000,
          location: 'Central London',
          propertyType: 'apartment',
          latitude: 51.5074,
          longitude: -0.1278
        },
        {
          title: 'Suburb House',
          price: 300000,
          location: 'Suburb',
          propertyType: 'house',
          latitude: 51.6074,
          longitude: -0.2278
        }
      ])
    })

    it('finds properties by location', async () => {
      const properties = await Property.findByLocation('51.5074,-0.1278', 10)
      expect(properties.length).toBeGreaterThan(0)
    })
  })
})

// Repository Pattern for better testability
// property-search-api/src/repositories/PropertyRepository.ts
import { Property } from '../models/Property'
import { PropertySearchFilters } from '../types/property'
import { Op, WhereOptions } from 'sequelize'

export interface IPropertyRepository {
  findById(id: string): Promise<Property | null>
  findAll(filters: PropertySearchFilters): Promise<{ properties: Property[], total: number }>
  create(data: any): Promise<Property>
  update(id: string, data: any): Promise<Property | null>
  delete(id: string): Promise<boolean>
}

export class PropertyRepository implements IPropertyRepository {
  async findById(id: string): Promise<Property | null> {
    return Property.findByPk(id)
  }

  async findAll(filters: PropertySearchFilters): Promise<{ properties: Property[], total: number }> {
    const where = this.buildWhereClause(filters)
    const { page = 1, limit = 20 } = filters
    const offset = (page - 1) * limit

    const [properties, total] = await Promise.all([
      Property.findAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      }),
      Property.count({ where })
    ])

    return { properties, total }
  }

  async create(data: any): Promise<Property> {
    return Property.create(data)
  }

  async update(id: string, data: any): Promise<Property | null> {
    const [affectedRows] = await Property.update(data, { where: { id } })
    if (affectedRows === 0) return null
    return this.findById(id)
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await Property.destroy({ where: { id } })
    return deleted > 0
  }

  private buildWhereClause(filters: PropertySearchFilters): WhereOptions {
    const where: WhereOptions = { isActive: true }

    if (filters.minPrice || filters.maxPrice) {
      where.price = {}
      if (filters.minPrice) where.price[Op.gte] = filters.minPrice
      if (filters.maxPrice) where.price[Op.lte] = filters.maxPrice
    }

    if (filters.bedrooms) {
      where.bedrooms = filters.bedrooms
    }

    if (filters.bathrooms) {
      where.bathrooms = { [Op.gte]: filters.bathrooms }
    }

    if (filters.location) {
      where.location = { [Op.iLike]: `%${filters.location}%` }
    }

    if (filters.propertyType) {
      where.propertyType = filters.propertyType
    }

    if (filters.features && filters.features.length > 0) {
      where.features = { [Op.contains]: filters.features }
    }

    return where
  }
}

// Mock repository for testing
export class MockPropertyRepository implements IPropertyRepository {
  private properties: Property[] = []
  private idCounter = 1

  async findById(id: string): Promise<Property | null> {
    return this.properties.find(p => p.id === id) || null
  }

  async findAll(filters: PropertySearchFilters): Promise<{ properties: Property[], total: number }> {
    let filtered = this.properties.filter(p => p.isActive)

    if (filters.minPrice) {
      filtered = filtered.filter(p => p.price >= filters.minPrice!)
    }
    if (filters.maxPrice) {
      filtered = filtered.filter(p => p.price <= filters.maxPrice!)
    }

    const total = filtered.length
    const { page = 1, limit = 20 } = filters
    const offset = (page - 1) * limit
    const properties = filtered.slice(offset, offset + limit)

    return { properties, total }
  }

  async create(data: any): Promise<Property> {
    const property = {
      id: (this.idCounter++).toString(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    } as Property

    this.properties.push(property)
    return property
  }

  async update(id: string, data: any): Promise<Property | null> {
    const index = this.properties.findIndex(p => p.id === id)
    if (index === -1) return null

    this.properties[index] = { ...this.properties[index], ...data, updatedAt: new Date() }
    return this.properties[index]
  }

  async delete(id: string): Promise<boolean> {
    const index = this.properties.findIndex(p => p.id === id)
    if (index === -1) return false

    this.properties.splice(index, 1)
    return true
  }

  // Test helpers
  reset(): void {
    this.properties = []
    this.idCounter = 1
  }

  seed(properties: Partial<Property>[]): void {
    this.properties = properties.map((p, i) => ({
      id: (i + 1).toString(),
      title: 'Test Property',
      price: 300000,
      location: 'Test Location',
      propertyType: 'apartment',
      images: [],
      features: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...p
    })) as Property[]
  }
}

// Test file: property-search-api/src/tests/repositories/PropertyRepository.test.ts
import { PropertyRepository, MockPropertyRepository } from '../../repositories/PropertyRepository'

describe('PropertyRepository', () => {
  let repository: MockPropertyRepository

  beforeEach(() => {
    repository = new MockPropertyRepository()
    repository.seed([
      { title: 'Cheap Property', price: 200000, bedrooms: 1 },
      { title: 'Expensive Property', price: 800000, bedrooms: 3 },
      { title: 'Medium Property', price: 400000, bedrooms: 2 }
    ])
  })

  describe('findAll', () => {
    it('returns all properties when no filters applied', async () => {
      const result = await repository.findAll({})
      expect(result.properties).toHaveLength(3)
      expect(result.total).toBe(3)
    })

    it('filters by price range', async () => {
      const result = await repository.findAll({
        minPrice: 300000,
        maxPrice: 500000
      })
      
      expect(result.properties).toHaveLength(1)
      expect(result.properties[0].title).toBe('Medium Property')
    })

    it('paginates results correctly', async () => {
      const result = await repository.findAll({
        page: 1,
        limit: 2
      })
      
      expect(result.properties).toHaveLength(2)
      expect(result.total).toBe(3)
    })
  })

  describe('create', () => {
    it('creates a new property', async () => {
      const propertyData = {
        title: 'New Property',
        price: 350000,
        location: 'New Location',
        propertyType: 'house'
      }

      const property = await repository.create(propertyData)
      
      expect(property.id).toBeDefined()
      expect(property.title).toBe(propertyData.title)
      expect(property.isActive).toBe(true)
    })
  })

  describe('update', () => {
    it('updates existing property', async () => {
      const property = await repository.create({
        title: 'Original',
        price: 300000,
        location: 'Location',
        propertyType: 'apartment'
      })

      const updated = await repository.update(property.id, {
        title: 'Updated Title'
      })

      expect(updated?.title).toBe('Updated Title')
      expect(updated?.price).toBe(300000) // Unchanged
    })

    it('returns null for non-existent property', async () => {
      const updated = await repository.update('non-existent', {
        title: 'Updated'
      })

      expect(updated).toBeNull()
    })
  })

  describe('delete', () => {
    it('deletes existing property', async () => {
      const property = await repository.create({
        title: 'To Delete',
        price: 300000,
        location: 'Location',
        propertyType: 'apartment'
      })

      const deleted = await repository.delete(property.id)
      expect(deleted).toBe(true)

      const found = await repository.findById(property.id)
      expect(found).toBeNull()
    })

    it('returns false for non-existent property', async () => {
      const deleted = await repository.delete('non-existent')
      expect(deleted).toBe(false)
    })
  })
})

// Advanced Search Service with TDD
// property-search-api/src/services/SearchService.ts
import { PropertyRepository } from '../repositories/PropertyRepository'
import { cacheService } from './cacheService'

export interface SearchFilters {
  query?: string
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  propertyType?: string
  features?: string[]
  sortBy?: 'price' | 'date' | 'relevance'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export class SearchService {
  constructor(private propertyRepository: PropertyRepository) {}

  async search(filters: SearchFilters) {
    const cacheKey = this.generateCacheKey(filters)
    
    // Try cache first
    const cached = await cacheService.get(cacheKey)
    if (cached) {
      return cached
    }

    // Perform search
    const result = await this.performSearch(filters)
    
    // Cache results for 5 minutes
    await cacheService.set(cacheKey, result, 300)
    
    return result
  }

  private async performSearch(filters: SearchFilters) {
    const { properties, total } = await this.propertyRepository.findAll(filters)
    
    // Apply text search if query provided
    let filteredProperties = properties
    if (filters.query) {
      filteredProperties = this.applyTextSearch(properties, filters.query)
    }

    // Apply sorting
    if (filters.sortBy) {
      filteredProperties = this.applySorting(filteredProperties, filters.sortBy, filters.sortOrder)
    }

    const { page = 1, limit = 20 } = filters
    const pages = Math.ceil(total / limit)

    return {
      properties: filteredProperties,
      total,
      page,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1
    }
  }

  private applyTextSearch(properties: any[], query: string): any[] {
    const searchTerms = query.toLowerCase().split(' ')
    
    return properties.filter(property => {
      const searchText = `${property.title} ${property.description} ${property.location}`.toLowerCase()
      return searchTerms.every(term => searchText.includes(term))
    })
  }

  private applySorting(properties: any[], sortBy: string, order: string = 'desc'): any[] {
    return [...properties].sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'price':
          comparison = a.price - b.price
          break
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        default:
          comparison = 0
      }
      
      return order === 'desc' ? -comparison : comparison
    })
  }

  private generateCacheKey(filters: SearchFilters): string {
    return `search:${JSON.stringify(filters)}`
  }
}

// Test file: property-search-api/src/tests/services/SearchService.test.ts
import { SearchService } from '../../services/SearchService'
import { MockPropertyRepository } from '../../repositories/PropertyRepository'

describe('SearchService', () => {
  let searchService: SearchService
  let mockRepository: MockPropertyRepository

  beforeEach(() => {
    mockRepository = new MockPropertyRepository()
    searchService = new SearchService(mockRepository)
    
    // Seed test data
    mockRepository.seed([
      {
        title: 'Modern Apartment in Central London',
        description: 'Beautiful modern apartment with great views',
        price: 500000,
        location: 'Central London',
        bedrooms: 2,
        createdAt: new Date('2023-01-01')
      },
      {
        title: 'Cozy House in Suburbs',
        description: 'Family-friendly house with garden',
        price: 350000,
        location: 'London Suburbs',
        bedrooms: 3,
        createdAt: new Date('2023-01-02')
      },
      {
        title: 'Luxury Penthouse',
        description: 'Premium penthouse with amazing facilities',
        price: 1000000,
        location: 'Central London',
        bedrooms: 4,
        createdAt: new Date('2023-01-03')
      }
    ])
  })

  describe('text search', () => {
    it('finds properties by title keywords', async () => {
      const result = await searchService.search({
        query: 'modern apartment'
      })
      
      expect(result.properties).toHaveLength(1)
      expect(result.properties[0].title).toContain('Modern Apartment')
    })

    it('finds properties by description keywords', async () => {
      const result = await searchService.search({
        query: 'garden'
      })
      
      expect(result.properties).toHaveLength(1)
      expect(result.properties[0].description).toContain('garden')
    })

    it('finds properties by location', async () => {
      const result = await searchService.search({
        query: 'central london'
      })
      
      expect(result.properties).toHaveLength(2)
    })
  })

  describe('sorting', () => {
    it('sorts by price ascending', async () => {
      const result = await searchService.search({
        sortBy: 'price',
        sortOrder: 'asc'
      })
      
      expect(result.properties[0].price).toBeLessThan(result.properties[1].price)
    })

    it('sorts by price descending', async () => {
      const result = await searchService.search({
        sortBy: 'price',
        sortOrder: 'desc'
      })
      
      expect(result.properties[0].price).toBeGreaterThan(result.properties[1].price)
    })

    it('sorts by date (newest first)', async () => {
      const result = await searchService.search({
        sortBy: 'date',
        sortOrder: 'desc'
      })
      
      expect(new Date(result.properties[0].createdAt))
        .toBeAfter(new Date(result.properties[1].createdAt))
    })
  })

  describe('pagination', () => {
    it('returns correct pagination info', async () => {
      const result = await searchService.search({
        page: 1,
        limit: 2
      })
      
      expect(result.page).toBe(1)
      expect(result.total).toBe(3)
      expect(result.pages).toBe(2)
      expect(result.hasNext).toBe(true)
      expect(result.hasPrev).toBe(false)
    })
  })
})