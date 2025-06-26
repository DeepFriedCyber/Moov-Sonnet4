import { DatabaseService } from '../lib/database';

export interface QueryPerformanceMetrics {
    executionTime: number;
    planningTime: number;
    totalTime: number;
    rowsReturned: number;
    indexesUsed: string[];
    scanTypes: string[];
    bufferHits: number;
    bufferReads: number;
    queryPlan: any;
}

export class QueryPerformanceAnalyzer {
    constructor(private database: DatabaseService) { }

    async measureQueryPerformance(
        query: string,
        params: any[] = []
    ): Promise<QueryPerformanceMetrics> {
        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            // Enable timing and buffer statistics
            await connection.query('SET track_io_timing = on');

            // Get query plan with execution statistics
            const explainQuery = `
        EXPLAIN (
          ANALYZE true,
          BUFFERS true,
          FORMAT json,
          TIMING true,
          VERBOSE true
        ) ${query}
      `;

            const result = await connection.query(explainQuery, params);
            const plan = result.rows[0]['QUERY PLAN'][0];

            return this.extractMetrics(plan);
        } finally {
            connection.release();
        }
    }

    private extractMetrics(plan: any): QueryPerformanceMetrics {
        const execution = plan['Execution Time'] || 0;
        const planning = plan['Planning Time'] || 0;

        const indexesUsed = this.extractIndexesFromPlan(plan.Plan);
        const scanTypes = this.extractScanTypes(plan.Plan);
        const bufferStats = this.extractBufferStats(plan.Plan);

        return {
            executionTime: execution,
            planningTime: planning,
            totalTime: execution + planning,
            rowsReturned: plan.Plan['Actual Rows'] || 0,
            indexesUsed,
            scanTypes,
            bufferHits: bufferStats.hits,
            bufferReads: bufferStats.reads,
            queryPlan: plan
        };
    }

    private extractIndexesFromPlan(plan: any): string[] {
        const indexes: string[] = [];

        const traverse = (node: any) => {
            if (node['Index Name']) {
                indexes.push(node['Index Name']);
            }

            if (node.Plans) {
                node.Plans.forEach(traverse);
            }
        };

        traverse(plan);
        return [...new Set(indexes)]; // Remove duplicates
    }

    private extractScanTypes(plan: any): string[] {
        const scanTypes: string[] = [];

        const traverse = (node: any) => {
            if (node['Node Type']) {
                scanTypes.push(node['Node Type']);
            }

            if (node.Plans) {
                node.Plans.forEach(traverse);
            }
        };

        traverse(plan);
        return [...new Set(scanTypes)];
    }

    private extractBufferStats(plan: any): { hits: number; reads: number } {
        let hits = 0;
        let reads = 0;

        const traverse = (node: any) => {
            hits += node['Shared Hit Blocks'] || 0;
            reads += node['Shared Read Blocks'] || 0;

            if (node.Plans) {
                node.Plans.forEach(traverse);
            }
        };

        traverse(plan);
        return { hits, reads };
    }

    async compareQueries(
        query1: string,
        query2: string,
        params: any[] = []
    ): Promise<{
        query1: QueryPerformanceMetrics;
        query2: QueryPerformanceMetrics;
        improvement: number;
    }> {
        const [metrics1, metrics2] = await Promise.all([
            this.measureQueryPerformance(query1, params),
            this.measureQueryPerformance(query2, params)
        ]);

        const improvement = (
            (metrics1.totalTime - metrics2.totalTime) / metrics1.totalTime
        ) * 100;

        return { query1: metrics1, query2: metrics2, improvement };
    }
}