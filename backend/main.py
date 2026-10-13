from fastapi import FastAPI

app = FastAPI(title="Task Flow API")


@app.get("/api/health")
def health():
    return {"status": "ok"}
