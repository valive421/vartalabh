from django.urls import path
from .views import SignIn, SignUP
from django.urls import include
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path('signin/', SignIn.as_view(), name='signin'),
    path('signup/', SignUP.as_view(), name='signup'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)