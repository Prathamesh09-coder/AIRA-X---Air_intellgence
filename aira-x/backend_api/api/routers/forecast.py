from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from datetime import datetime, timedelta
import json

from db.database import get_db
from db.redis_db import get_redis
from models.schemas import ForecastRequest, ForecastResponse
from models.sql_models import AQIForecast
from core.logging import logger
from ml.inference import inference_engine

router = APIRouter(prefix="/forecast", tags=["forecast"])

@router.post("/", response_model=list[ForecastResponse])
async def get_forecast(req: ForecastRequest, db: AsyncSession = Depends(get_db), redis=Depends(get_redis)):
    cache_key = f"forecast:{req.lat}:{req.lon}:{req.hours}"
    cached = await redis.get(cache_key)
    if cached:
        logger.info("Cache hit for forecast")
        try:
            data = json.loads(cached)
            return [ForecastResponse(**d) for d in data]
        except Exception as e:
            logger.warning(f"Failed to parse cached forecast: {e}")
            pass
    
    try:
        # Run GNN model inference
        predictions = inference_engine.predict(req.lat, req.lon, req.hours)
        
        # Format and save to Redis cache (expires in 10 minutes)
        cached_payload = [
            {
                "timestamp": p["timestamp"].isoformat(),
                "pm25": p["pm25"],
                "pm10": p["pm10"],
                "no2": p["no2"],
                "so2": p["so2"],
                "aqi": p["aqi"]
            } for p in predictions
        ]
        await redis.setex(cache_key, 600, json.dumps(cached_payload))
        
        return [
            ForecastResponse(
                timestamp=p["timestamp"],
                pm25=p["pm25"],
                pm10=p["pm10"],
                no2=p["no2"],
                so2=p["so2"],
                aqi=p["aqi"]
            ) for p in predictions
        ]
    except Exception as e:
        logger.error(f"Inference engine failure: {e}")
        raise HTTPException(status_code=500, detail=f"AQI Forecasting engine failed: {str(e)}")
