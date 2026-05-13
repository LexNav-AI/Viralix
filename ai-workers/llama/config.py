"""
Llama worker configuration — all values sourced from environment variables.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Model
MODEL_PATH: str = os.getenv("MODEL_PATH", "/models/llama3-70b.Q4_K_M.gguf")
N_GPU_LAYERS: int = int(os.getenv("N_GPU_LAYERS", "-1"))  # -1 = offload all layers
N_CTX: int = int(os.getenv("N_CTX", "4096"))
N_BATCH: int = int(os.getenv("N_BATCH", "512"))
N_THREADS: int = int(os.getenv("N_THREADS", "8"))

# Inference defaults
DEFAULT_MAX_TOKENS: int = int(os.getenv("DEFAULT_MAX_TOKENS", "1024"))
DEFAULT_TEMPERATURE: float = float(os.getenv("DEFAULT_TEMPERATURE", "0.7"))
DEFAULT_TOP_P: float = float(os.getenv("DEFAULT_TOP_P", "0.9"))
DEFAULT_TOP_K: int = int(os.getenv("DEFAULT_TOP_K", "40"))
DEFAULT_REPEAT_PENALTY: float = float(os.getenv("DEFAULT_REPEAT_PENALTY", "1.1"))

# Server
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8100"))
WORKERS: int = int(os.getenv("WORKERS", "1"))

# Logging
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "info")
LOG_PROMPTS: bool = os.getenv("LOG_PROMPTS", "false").lower() == "true"
