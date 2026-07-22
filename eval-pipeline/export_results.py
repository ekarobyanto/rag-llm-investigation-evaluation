import os
import psycopg2
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

def get_db_connection():
    db_url = os.environ.get('DATABASE_URL')
    return psycopg2.connect(db_url)

def fetch_combined_metrics(conn):
    query = """
    SELECT 
        l.retrieval_method,
        s.difficulty,
        
        -- Deterministic Metrics
        l."correctnessScore",
        l."retrievalPrecision",
        l."retrievalRecall",
        l."topKAccuracy",
        l."totalResponseTimeMs",
        
        -- Ragas Metrics
        r.faithfulness,
        r."answerRelevance",
        r."contextPrecision",
        r."contextRecall"
        
    FROM ai_interaction_logs l
    JOIN evaluation_scenarios s ON l."scenarioId" = s.id
    LEFT JOIN ragas_evaluations r ON l.id = r."logId"
    """
    
    return pd.read_sql_query(query, conn)

def main():
    print("Connecting to database...")
    conn = get_db_connection()
    
    print("Fetching combined metrics...")
    df = fetch_combined_metrics(conn)
    
    if df.empty:
        print("No evaluation data found.")
        return
        
    print("Aggregating metrics by retrieval strategy...")
    
    # Calculate means grouped by retrieval_method
    summary_df = df.groupby('retrieval_method').mean(numeric_only=True).reset_index()
    
    # Also compute per-difficulty breakdown
    difficulty_df = df.groupby(['retrieval_method', 'difficulty']).mean(numeric_only=True).reset_index()
    
    # Ensure results directory exists
    results_dir = os.path.join(os.path.dirname(__file__), 'results')
    os.makedirs(results_dir, exist_ok=True)
    
    # Export
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    csv_path = os.path.join(results_dir, f'experiment_results_{timestamp}.csv')
    json_path = os.path.join(results_dir, f'experiment_results_{timestamp}.json')
    
    # Save detailed logs
    df.to_csv(csv_path.replace('experiment_results', 'detailed_logs'), index=False)
    
    difficulty_df.to_csv(csv_path.replace('experiment_results', 'difficulty_breakdown'), index=False)
    
    # Save summary
    summary_df.to_csv(csv_path, index=False)
    summary_df.to_json(json_path, orient='records', indent=2)
    
    print(f"\nExperiment Results Exported:")
    print(f"Summary CSV: {csv_path}")
    print(f"Summary JSON: {json_path}")
    
    print("\nPreview of Summary:")
    print(summary_df.to_string())

if __name__ == "__main__":
    main()
