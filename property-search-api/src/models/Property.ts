// ============================================================================
// Enhanced Property Model with TDD Approach
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PropertyAttributes {
    id: string;
    title: string;
    description?: string;
    price: number;
    location: string;
    latitude?: number;
    longitude?: number;
    bedrooms?: number;
    bathrooms?: number;
    area?: number;
    propertyType: 'apartment' | 'house' | 'studio' | 'commercial';
    images: string[];
    features: string[];
    isActive: boolean;
    embedding?: number[]; // For vector search
    createdAt: Date;
    updatedAt: Date;
}

interface PropertyCreationAttributes extends Optional<PropertyAttributes, 'id' | 'createdAt' | 'updatedAt'> { }

export class Property extends Model<PropertyAttributes, PropertyCreationAttributes>
    implements PropertyAttributes {
    public id!: string;
    public title!: string;
    public description?: string;
    public price!: number;
    public location!: string;
    public latitude?: number;
    public longitude?: number;
    public bedrooms?: number;
    public bathrooms?: number;
    public area?: number;
    public propertyType!: 'apartment' | 'house' | 'studio' | 'commercial';
    public images!: string[];
    public features!: string[];
    public isActive!: boolean;
    public embedding?: number[];
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    // Instance methods
    public calculatePricePerSqFt(): number | null {
        return this.area ? Math.round(this.price / this.area) : null;
    }

    public isAffordable(maxBudget: number): boolean {
        return this.price <= maxBudget;
    }

    public hasFeature(feature: string): boolean {
        return this.features.includes(feature);
    }

    // Static methods
    static async findByLocation(location: string, radius = 5): Promise<Property[]> {
        return this.findAll({
            where: sequelize.where(
                sequelize.fn('LOWER', sequelize.col('location')),
                'LIKE',
                `%${location.toLowerCase()}%`
            )
        });
    }

    static async findByPriceRange(minPrice: number, maxPrice: number): Promise<Property[]> {
        return this.findAll({
            where: {
                price: {
                    [sequelize.Op.between]: [minPrice, maxPrice]
                },
                isActive: true
            }
        });
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
            len: [3, 100],
            notEmpty: true
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
            min: 0,
            isDecimal: true
        }
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
        validate: {
            min: -90,
            max: 90
        }
    },
    longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
        validate: {
            min: -180,
            max: 180
        }
    },
    bedrooms: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 0,
            max: 20,
            isInt: true
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
            min: 1,
            isInt: true
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
        defaultValue: [],
        validate: {
            isArray(value: any) {
                if (!Array.isArray(value)) {
                    throw new Error('Images must be an array');
                }
            }
        }
    },
    features: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        validate: {
            isArray(value: any) {
                if (!Array.isArray(value)) {
                    throw new Error('Features must be an array');
                }
            }
        }
    },
    embedding: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Vector embedding for semantic search'
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
        { fields: ['createdAt'] },
        { fields: ['price', 'bedrooms'] }, // Composite index for common searches
        { fields: ['location', 'propertyType'] } // Composite index for location + type
    ],
    hooks: {
        beforeValidate: (property: Property) => {
            // Normalize location
            if (property.location) {
                property.location = property.location.trim();
            }

            // Ensure features are unique
            if (property.features) {
                property.features = [...new Set(property.features)];
            }
        }
    }
});

export default Property;