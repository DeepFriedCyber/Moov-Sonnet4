'use client'

import React from 'react'
import { SearchBox } from '@/components/search/SearchBox'
import { ChatWidget } from '@/components/chat/ChatWidget'

export default function HomePage() {
  return React.createElement('div', {
    className: "min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50"
  },

    // Enhanced Navigation with glassmorphism
    React.createElement('nav', {
      className: "relative z-10 bg-white/90 backdrop-blur-xl border-b border-gray-200/50 shadow-sm"
    },
      React.createElement('div', { className: "container mx-auto px-4 py-4" },
        React.createElement('div', { className: "flex items-center justify-between" },
          React.createElement('div', { className: "flex items-center space-x-3" },
            React.createElement('div', {
              className: "w-10 h-10 bg-gradient-to-br from-blue-600 via-purple-600 to-violet-600 rounded-xl shadow-lg flex items-center justify-center"
            },
              React.createElement('span', { className: "text-white font-bold text-lg" }, "P")
            ),
            React.createElement('span', { className: "text-2xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent" }, "PropertySearch UK")
          ),
          React.createElement('div', { className: "hidden md:flex items-center space-x-8" },
            React.createElement('a', {
              href: "#",
              className: "text-gray-600 hover:text-blue-600 transition-all duration-300 font-medium relative group"
            },
              "Search",
              React.createElement('span', { className: "absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full" })
            ),
            React.createElement('a', {
              href: "#",
              className: "text-gray-600 hover:text-blue-600 transition-all duration-300 font-medium relative group"
            },
              "About",
              React.createElement('span', { className: "absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full" })
            ),
            React.createElement('button', {
              className: "px-6 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-full hover:shadow-lg hover:scale-105 transition-all duration-300 font-semibold"
            }, "Sign In")
          )
        )
      )
    ),

    // Enhanced Hero Section with animated elements
    React.createElement('section', { className: "relative overflow-hidden min-h-[80vh] flex items-center" },
      // Animated background pattern
      React.createElement('div', {
        className: "absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23f1f5f9\" fill-opacity=\"0.4\"%3E%3Cpath d=\"m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] animate-pulse"
      }),

      // Floating orbs for visual interest
      React.createElement('div', { className: "absolute top-20 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse" }),
      React.createElement('div', { className: "absolute bottom-20 right-10 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl animate-pulse delay-1000" }),
      React.createElement('div', { className: "absolute top-1/2 left-1/3 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-500" }),

      React.createElement('div', {
        className: "absolute inset-0 bg-gradient-to-r from-blue-600/10 via-transparent to-violet-600/10"
      }),

      React.createElement('div', { className: "relative container mx-auto px-4 py-20 lg:py-32" },
        React.createElement('div', { className: "max-w-6xl mx-auto text-center" },
          // Enhanced badge with animation
          React.createElement('div', {
            className: "inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-100 to-violet-100 text-blue-700 rounded-full text-sm font-semibold mb-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-blue-200/50"
          },
            React.createElement('div', { className: "relative" },
              React.createElement('svg', {
                className: "w-5 h-5 animate-pulse",
                fill: "currentColor",
                viewBox: "0 0 20 20"
              },
                React.createElement('path', {
                  fillRule: "evenodd",
                  d: "M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z",
                  clipRule: "evenodd"
                })
              ),
              React.createElement('div', { className: "absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-ping" })
            ),
            "🚀 AI-Powered Property Search"
          ),

          // Enhanced main heading with better typography
          React.createElement('h1', {
            className: "text-6xl md:text-7xl lg:text-8xl font-black text-gray-900 mb-8 leading-tight"
          },
            "Find Your ",
            React.createElement('span', {
              className: "bg-gradient-to-r from-blue-600 via-purple-600 to-violet-600 bg-clip-text text-transparent animate-pulse"
            }, "Dream Home"),
            React.createElement('br'),
            React.createElement('span', { className: "text-5xl md:text-6xl lg:text-7xl text-gray-700" }, "Effortlessly")
          ),

          // Enhanced subtitle
          React.createElement('p', {
            className: "text-xl md:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed font-light"
          },
            "🎯 Search properties using ",
            React.createElement('span', { className: "font-semibold text-blue-600" }, "natural language"),
            ". Our intelligent AI understands exactly what you're looking for and matches you with homes that fit your lifestyle perfectly."
          ),

          // Enhanced search box container
          React.createElement('div', { className: "max-w-4xl mx-auto mb-16 relative" },
            React.createElement('div', { className: "absolute -inset-1 bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000" }),
            React.createElement('div', { className: "relative bg-white rounded-xl p-2 shadow-2xl" },
              React.createElement(SearchBox)
            )
          ),

          // Enhanced quick filters with better styling
          React.createElement('div', { className: "mb-20" },
            React.createElement('p', { className: "text-sm text-gray-500 mb-6 font-medium" }, "✨ Popular searches:"),
            React.createElement('div', { className: "flex flex-wrap justify-center gap-4" },
              [
                { text: '🏡 Family homes with gardens', gradient: 'from-green-500 to-emerald-600' },
                { text: '🚇 Modern flats near transport', gradient: 'from-blue-500 to-cyan-600' },
                { text: '🚗 Properties with parking', gradient: 'from-purple-500 to-violet-600' },
                { text: '🎓 Homes near good schools', gradient: 'from-orange-500 to-red-600' }
              ].map((filter) =>
                React.createElement('button', {
                  key: filter.text,
                  className: "group px-8 py-4 bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl hover:shadow-2xl transition-all duration-500 hover:scale-110 hover:-translate-y-1 relative overflow-hidden"
                },
                  React.createElement('div', {
                    className: `absolute inset-0 bg-gradient-to-r ${filter.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`
                  }),
                  React.createElement('span', { className: "relative text-gray-700 group-hover:text-gray-900 transition-colors font-medium" }, filter.text)
                )
              )
            )
          )
        )
      )
    ),

    // Enhanced Features Section
    React.createElement('section', { className: "py-24 bg-gradient-to-b from-white to-gray-50" },
      React.createElement('div', { className: "container mx-auto px-4" },
        React.createElement('div', { className: "max-w-4xl mx-auto text-center mb-20" },
          React.createElement('h2', { className: "text-4xl md:text-5xl font-bold text-gray-900 mb-6" },
            "Why Choose ",
            React.createElement('span', { className: "bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent" }, "PropertySearch UK"),
            "? 🏆"
          ),
          React.createElement('p', { className: "text-xl text-gray-600 font-light" },
            "Experience the future of property search with our intelligent platform"
          )
        ),

        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-10 max-w-7xl mx-auto" },
          [
            {
              icon: '🤖',
              title: 'AI-Powered Matching',
              description: 'Our advanced AI understands your preferences and finds properties that truly match your lifestyle',
              gradient: 'from-blue-500 to-cyan-600'
            },
            {
              icon: '💬',
              title: 'Natural Language Search',
              description: 'Search like you talk - "3 bedroom house with garden near good schools" and find exactly what you need',
              gradient: 'from-purple-500 to-violet-600'
            },
            {
              icon: '⚡',
              title: 'Instant Results',
              description: 'Get personalized property recommendations in seconds, not hours of browsing',
              gradient: 'from-orange-500 to-red-600'
            }
          ].map(function (feature, index) {
            return React.createElement('div', {
              key: index,
              className: "group text-center p-10 rounded-3xl bg-white hover:bg-gradient-to-br hover:from-white hover:to-gray-50 transition-all duration-500 hover:shadow-2xl hover:scale-105 border border-gray-100 relative overflow-hidden"
            },
              React.createElement('div', {
                className: `absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`
              }),
              React.createElement('div', { className: "text-6xl mb-6 group-hover:scale-125 transition-transform duration-500" },
                feature.icon
              ),
              React.createElement('h3', { className: "text-2xl font-bold text-gray-900 mb-6" },
                feature.title
              ),
              React.createElement('p', { className: "text-gray-600 leading-relaxed text-lg" },
                feature.description
              )
            )
          })
        )
      )
    ),

    // Add Statistics Section
    React.createElement('section', { className: "py-20 bg-gradient-to-r from-blue-600 via-purple-600 to-violet-600 relative overflow-hidden" },
      React.createElement('div', { className: "absolute inset-0 bg-black/10" }),
      React.createElement('div', { className: "container mx-auto px-4 relative" },
        React.createElement('div', { className: "grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto text-center text-white" },
          [
            { number: '10,000+', label: '🏘️ Properties Available', icon: '🏘️' },
            { number: '50+', label: '🌍 Cities Covered', icon: '🌍' },
            { number: '95%', label: '😊 Customer Satisfaction', icon: '😊' },
            { number: '24/7', label: '🔄 AI Support', icon: '🔄' }
          ].map((stat, index) =>
            React.createElement('div', {
              key: index,
              className: "group hover:scale-110 transition-transform duration-300"
            },
              React.createElement('div', { className: "text-5xl md:text-6xl font-black mb-3 group-hover:text-yellow-300 transition-colors" },
                stat.number
              ),
              React.createElement('div', { className: "text-lg text-blue-100 group-hover:text-white transition-colors font-medium" },
                stat.label
              )
            )
          )
        )
      )
    ),

    React.createElement(ChatWidget)
  )
}
