from django.urls import re_path
from .consumers import ChatConsumer, VideoCallConsumer

websocket_urlpatterns = [
    re_path(r'^chat/', ChatConsumer.as_asgi()),
    re_path(r'^ws/video/', VideoCallConsumer.as_asgi()),
]