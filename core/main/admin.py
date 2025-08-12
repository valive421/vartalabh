from django.contrib import admin
from .models import User, Connection , Message
# Register your models here.
admin.site.register(User)
admin.site.register(Connection)
admin.site.register(Message)  # Register Message model
