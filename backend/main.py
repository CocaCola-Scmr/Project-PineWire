from fastapi import FastAPI

# Create the application instance
app = FastAPI()

# Define a route decorator for HTTP GET requests to the root URL
@app.get("/")
def read_root():
    # Return a standard Python dictionary (FastAPI automatically converts this to JSON)
    return {"message": "Hello Naman!"}
