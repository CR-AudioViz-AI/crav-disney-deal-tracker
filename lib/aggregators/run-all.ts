import { aggregateDisneyParksBlog } from './disney-parks-blog'
import { aggregateMouseSavers } from './mousesavers'
import { aggregateDisneyTouristBlog } from './disney-tourist-blog'
import { aggregateDISboards } from './disboards'
import { aggregateAllEars } from './allears'
import { aggregateRedditWDW } from './reddit-wdw'

export async function runAllAggregators() {
  console.log('=== Starting Deal Aggregation ===')
  console.log(`Timestamp: ${new Date().toISOString()}`)
  
  const results = {
    timestamp: new Date().toISOString(),
    aggregators: [] as Array<{
      name: string
      success: boolean
      dealsFound?: number
      error?: string
      duration: number
    }>
  }
  
  // Disney Parks Blog
  try {
    const startTime = Date.now()
    const result = await aggregateDisneyParksBlog()
    const duration = Date.now() - startTime
    
    results.aggregators.push({
      name: 'Disney Parks Blog',
      success: result.success,
      dealsFound: result.dealsFound,
      error: result.error,
      duration
    })
  } catch (error) {
    results.aggregators.push({
      name: 'Disney Parks Blog',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: 0
    })
  }
  
  // MouseSavers
  try {
    const startTime = Date.now()
    const result = await aggregateMouseSavers()
    const duration = Date.now() - startTime
    
    results.aggregators.push({
      name: 'MouseSavers',
      success: result.success,
      dealsFound: result.dealsFound,
      error: result.error,
      duration
    })
  } catch (error) {
    results.aggregators.push({
      name: 'MouseSavers',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: 0
    })
  }
  
  // Disney Tourist Blog (NEW - High Priority)
  try {
    const startTime = Date.now()
    const result = await aggregateDisneyTouristBlog()
    const duration = Date.now() - startTime
    
    results.aggregators.push({
      name: 'Disney Tourist Blog',
      success: result.success,
      dealsFound: result.dealsFound,
      error: result.error,
      duration
    })
  } catch (error) {
    results.aggregators.push({
      name: 'Disney Tourist Blog',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: 0
    })
  }
  
  // DISboards Forum (NEW)
  try {
    const startTime = Date.now()
    const result = await aggregateDISboards()
    const duration = Date.now() - startTime
    
    results.aggregators.push({
      name: 'DISboards',
      success: result.success,
      dealsFound: result.dealsFound,
      error: result.error,
      duration
    })
  } catch (error) {
    results.aggregators.push({
      name: 'DISboards',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: 0
    })
  }
  
  // AllEars.net (NEW)
  try {
    const startTime = Date.now()
    const result = await aggregateAllEars()
    const duration = Date.now() - startTime
    
    results.aggregators.push({
      name: 'AllEars.net',
      success: result.success,
      dealsFound: result.dealsFound,
      error: result.error,
      duration
    })
  } catch (error) {
    results.aggregators.push({
      name: 'AllEars.net',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: 0
    })
  }
  
  // Reddit r/WaltDisneyWorld (NEW)
  try {
    const startTime = Date.now()
    const result = await aggregateRedditWDW()
    const duration = Date.now() - startTime
    
    results.aggregators.push({
      name: 'Reddit WaltDisneyWorld',
      success: result.success,
      dealsFound: result.dealsFound,
      error: result.error,
      duration
    })
  } catch (error) {
    results.aggregators.push({
      name: 'Reddit WaltDisneyWorld',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: 0
    })
  }
  
  // Summary
  const totalDeals = results.aggregators.reduce((sum, agg) => sum + (agg.dealsFound || 0), 0)
  const successCount = results.aggregators.filter(agg => agg.success).length
  const failureCount = results.aggregators.length - successCount
  
  console.log('\n=== Aggregation Summary ===')
  console.log(`Total deals found: ${totalDeals}`)
  console.log(`Successful sources: ${successCount}/${results.aggregators.length}`)
  console.log(`Failed sources: ${failureCount}`)
  
  results.aggregators.forEach(agg => {
    const status = agg.success ? '✓' : '✗'
    console.log(`${status} ${agg.name}: ${agg.dealsFound || 0} deals (${agg.duration}ms)`)
    if (agg.error) {
      console.log(`  Error: ${agg.error}`)
    }
  })
  
  return results
}

// Allow running from command line
if (require.main === module) {
  runAllAggregators()
    .then(results => {
      console.log('\nAggregation complete!')
      process.exit(0)
    })
    .catch(error => {
      console.error('Fatal error during aggregation:', error)
      process.exit(1)
    })
}
