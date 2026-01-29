from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agents.graph import agent
import json
import asyncio
import sys
from io import StringIO
import threading
import queue

app = FastAPI()

class GenerateRequest(BaseModel):
    prompt: str

class GenerateResponse(BaseModel):
    status: str
    project_root: str

class LogCapture:
    def __init__(self, log_queue):
        self.log_queue = log_queue
        self.terminal = sys.stdout
        
    def write(self, message):
        if message.strip():
            self.log_queue.put(message.strip())
        self.terminal.write(message)
        
    def flush(self):
        self.terminal.flush()

async def event_stream(prompt: str):
    """Stream events from the agent execution"""
    
    log_queue = queue.Queue()
    
    # Send initial message
    yield f"data: {json.dumps({'type': 'message', 'content': 'Hey! I got your request. Let me start building that for you...'})}\n\n"
    await asyncio.sleep(0.3)
    
    # Start capturing logs
    old_stdout = sys.stdout
    sys.stdout = LogCapture(log_queue)
    
    # Run agent in background thread
    result = {}
    def run_agent():
        nonlocal result
        try:
            result = agent.invoke({"user_prompt": prompt})
        except Exception as e:
            result = {"error": str(e)}
    
    agent_thread = threading.Thread(target=run_agent)
    agent_thread.start()
    
    # Stream logs as they come
    while agent_thread.is_alive() or not log_queue.empty():
        try:
            log_message = log_queue.get(timeout=0.1)
            yield f"data: {json.dumps({'type': 'log', 'content': log_message})}\n\n"
        except queue.Empty:
            await asyncio.sleep(0.1)
    
    agent_thread.join()
    
    # Restore stdout
    sys.stdout = old_stdout
    
    # Send completion message
    await asyncio.sleep(0.3)
    
    if "error" in result:
        yield f"data: {json.dumps({'type': 'error', 'content': result['error']})}\n\n"
    else:
        yield f"data: {json.dumps({'type': 'message', 'content': '🎉 Perfect! Your project is ready!'})}\n\n"
        project_root = result.get("project_root", "")
        yield f"data: {json.dumps({'type': 'complete', 'project_root': project_root})}\n\n"
    
    project_root = result.get("project_root", "")
    yield f"data: {json.dumps({'type': 'complete', 'project_root': project_root})}\n\n"

@app.post("/generate/stream")
async def generate_project_stream(req: GenerateRequest):
    """Stream the generation process"""
    return StreamingResponse(
        event_stream(req.prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

@app.post("/generate", response_model=GenerateResponse)
def generate_project(req: GenerateRequest):
    print(req.prompt)
    result = agent.invoke({
        "user_prompt": req.prompt
    })

    return {
        "status": "completed",
        "project_root": result.get("project_root", "")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)