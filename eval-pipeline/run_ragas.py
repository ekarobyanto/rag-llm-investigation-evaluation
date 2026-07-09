import os
import psycopg2
import psycopg2.extras
import pandas as pd
from datasets import Dataset
from dotenv import load_dotenv

# RAGAS specific imports
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevance, context_precision, context_recall
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# Load environment variables
# Fallback to parent directory's .env if not found locally
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

def get_db_connection():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL is not set in environment.")
    # Psycopg2 requires postgresql:// instead of postgres:// sometimes, but usually handles it.
    conn = psycopg2.connect(db_url)
    return conn

def fetch_unevaluated_logs(conn):
    """Fetch logs that belong to a scenario but have no RagasEvaluation yet."""
    query = """
    SELECT 
        l.id as log_id,
        l."userPrompt" as question,
        l."aiResponse" as answer,
        l."retrievedContextsList" as contexts,
        s."referenceAnswer" as ground_truth
    FROM ai_interaction_logs l
    JOIN evaluation_scenarios s ON l."scenarioId" = s.id
    LEFT JOIN ragas_evaluations r ON l.id = r."logId"
    WHERE l."scenarioId" IS NOT NULL
      AND r.id IS NULL
    """
    
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(query)
        rows = cur.fetchall()
        
    return [dict(r) for r in rows]

def save_evaluations(conn, results_df):
    """Save the RAGAS metrics to the ragas_evaluations table."""
    insert_query = """
    INSERT INTO ragas_evaluations 
        (id, "logId", faithfulness, "answerRelevance", "contextPrecision", "contextRecall")
    VALUES 
        (gen_random_uuid(), %s, %s, %s, %s, %s)
    """
    
    with conn.cursor() as cur:
        for _, row in results_df.iterrows():
            cur.execute(insert_query, (
                row['log_id'],
                row.get('faithfulness', None),
                row.get('answer_relevance', None),
                row.get('context_precision', None),
                row.get('context_recall', None)
            ))
    conn.commit()

def main():
    print("Connecting to database...")
    conn = get_db_connection()
    
    print("Fetching unevaluated logs...")
    logs = fetch_unevaluated_logs(conn)
    
    if not logs:
        print("No unevaluated logs found. Exiting.")
        return
        
    print(f"Found {len(logs)} logs to evaluate.")
    
    # Ragas requires contexts to be a list of strings
    # We parse the JSON if it's stringified
    for log in logs:
        if isinstance(log['contexts'], str):
            import json
            try:
                log['contexts'] = json.loads(log['contexts'])
            except:
                log['contexts'] = [log['contexts']]
        elif not log['contexts']:
            log['contexts'] = [""]
            
        # Ensure ground truth is present
        if not log['ground_truth']:
            log['ground_truth'] = "Unknown"
    
    # Create HuggingFace Dataset
    dataset = Dataset.from_pandas(pd.DataFrame(logs))
    
    print("Initializing LLM Judges...")
    # Initialize LangChain wrappers for OpenAI
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    
    print("Running RAGAS evaluation (this may take a while)...")
    result = evaluate(
        dataset=dataset,
        metrics=[
            faithfulness,
            answer_relevance,
            context_precision,
            context_recall,
        ],
        llm=llm,
        embeddings=embeddings,
    )
    
    print("Evaluation complete. Saving results...")
    
    # result is a dictionary-like object, convert to pandas
    results_df = result.to_pandas()
    
    # Merge log_id back if missing (evaluate sometimes preserves index or drops columns)
    if 'log_id' not in results_df.columns:
        results_df['log_id'] = [log['log_id'] for log in logs]
        
    save_evaluations(conn, results_df)
    print(f"Successfully saved {len(results_df)} evaluations.")
    
if __name__ == "__main__":
    main()
