import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Property } from '@/types/property';

interface PropertyFilters {
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  features?: string[];
  radius?: number;
  location?: string;
}

interface PropertyState {
  // Properties
  properties: Property[];
  totalCount: number;
  currentPage: number;
  
  // Search
  searchQuery: string;
  filters: PropertyFilters;
  sortBy: 'relevance' | 'price_asc' | 'price_desc' | 'date';
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // User data
  favorites: string[];
  viewHistory: Property[];
  
  // Computed
  hasMore: boolean;
  
  // Actions
  setProperties: (properties: Property[]) => void;
  appendProperties: (properties: Property[]) => void;
  updateProperty: (id: string, updates: Partial<Property>) => void;
  setTotalCount: (count: number) => void;
  
  setSearchQuery: (query: string) => void;
  setFilters: (filters: PropertyFilters) => void;
  setSortBy: (sort: PropertyState['sortBy']) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  
  addToHistory: (property: Property) => void;
  clearHistory: () => void;
  
  nextPage: () => void;
  resetPagination: () => void;
  clearAll: () => void;
}

export const usePropertyStore = create<PropertyState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        properties: [],
        totalCount: 0,
        currentPage: 1,
        searchQuery: '',
        filters: {},
        sortBy: 'relevance',
        isLoading: false,
        error: null,
        favorites: [],
        viewHistory: [],
        hasMore: false,

        // Actions
        setProperties: (properties) => set((state) => {
          state.properties = properties;
          state.hasMore = properties.length < state.totalCount;
        }),

        appendProperties: (properties) => set((state) => {
          state.properties.push(...properties);
          state.hasMore = state.properties.length < state.totalCount;
        }),

        updateProperty: (id, updates) => set((state) => {
          const index = state.properties.findIndex(p => p.id === id);
          if (index !== -1) {
            Object.assign(state.properties[index], updates);
          }
        }),

        setTotalCount: (count) => set((state) => {
          state.totalCount = count;
          state.hasMore = state.properties.length < count;
        }),

        setSearchQuery: (query) => set((state) => {
          state.searchQuery = query;
          state.currentPage = 1;
        }),

        setFilters: (filters) => set((state) => {
          state.filters = filters;
          state.currentPage = 1;
        }),

        setSortBy: (sort) => set((state) => {
          state.sortBy = sort;
          state.currentPage = 1;
        }),

        setLoading: (loading) => set((state) => {
          state.isLoading = loading;
        }),

        setError: (error) => set((state) => {
          state.error = error;
        }),

        addFavorite: (id) => set((state) => {
          if (!state.favorites.includes(id)) {
            state.favorites.push(id);
          }
        }),

        removeFavorite: (id) => set((state) => {
          state.favorites = state.favorites.filter(f => f !== id);
        }),

        toggleFavorite: (id) => {
          const isFav = get().isFavorite(id);
          if (isFav) {
            get().removeFavorite(id);
          } else {
            get().addFavorite(id);
          }
        },

        isFavorite: (id) => get().favorites.includes(id),

        addToHistory: (property) => set((state) => {
          // Remove if already exists
          state.viewHistory = state.viewHistory.filter(p => p.id !== property.id);
          // Add to beginning
          state.viewHistory.unshift(property);
          // Keep only last 10
          state.viewHistory = state.viewHistory.slice(0, 10);
        }),

        clearHistory: () => set((state) => {
          state.viewHistory = [];
        }),

        nextPage: () => set((state) => {
          state.currentPage += 1;
        }),

        resetPagination: () => set((state) => {
          state.currentPage = 1;
          state.properties = [];
        }),

        clearAll: () => set((state) => {
          state.properties = [];
          state.totalCount = 0;
          state.currentPage = 1;
          state.searchQuery = '';
          state.filters = {};
          state.sortBy = 'relevance';
          state.isLoading = false;
          state.error = null;
        }),
      })),
      {
        name: 'property-storage',
        partialize: (state) => ({
          favorites: state.favorites,
          viewHistory: state.viewHistory,
          filters: state.filters,
          sortBy: state.sortBy,
        }),
      }
    ),
    {
      name: 'property-store',
    }
  )
);