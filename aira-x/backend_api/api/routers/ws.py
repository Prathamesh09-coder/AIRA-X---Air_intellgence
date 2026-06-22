from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json
import random
from datetime import datetime
from core.logging import logger

router = APIRouter(prefix="/ws", tags=["websocket"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"Failed to send WS message: {e}")
                pass

manager = ConnectionManager()

@router.websocket("")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Simulate real-time updates every 5 seconds
            await asyncio.sleep(5)
            
            # Simulated micro-variance for AQI
            delta = random.choice([-2, -1, 0, 1, 2])
            alert = None
            
            # 10% chance of generating a new alert
            if random.random() < 0.10:
                alert = {
                    "id": f"a{random.randint(10, 99)}",
                    "severity": random.choice(["critical", "high", "medium"]),
                    "ward": random.choice(["Anand Vihar", "Connaught Place", "Rohini", "Dwarka", "Okhla Vihar", "Lajpat Nagar"]),
                    "message": random.choice([
                        "CPCB sensor reports sudden PM2.5 rise due to traffic congestion",
                        "Construction dust threshold violation warning issued",
                        "Upwind crop fire smoke plume boundary entering city limits",
                        "Electrostatic Precipitator failure suspected at industrial unit"
                    ]),
                    "time": "Just now"
                }
                
            payload = {
                "type": "realtime_update",
                "timestamp": datetime.utcnow().isoformat(),
                "aqi_delta": delta,
                "new_alert": alert
            }
            await websocket.send_text(json.dumps(payload))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
