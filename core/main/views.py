from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework.permissions import AllowAny
from .serializer import UserSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .serializer import SignUPSerializer
from .models import User


# Create your views here.
def get_authenticated_user_data(user):
    tokens = RefreshToken.for_user(user)

    return {
        'user': UserSerializer(user).data,
        'tokens': {
            'access': str(tokens.access_token),
            'refresh': str(tokens),
        }
    }
    


class SignIn(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        if not username or not password:
            return Response({'error': 'Username and password are required'}, status=400)
        user = authenticate(request, username=username, password=password)
        if not user:
            return Response({'error': 'Invalid credentials'}, status=401)
        user_data = get_authenticated_user_data(user)
        return Response(user_data, status=200)
    
class SignUP(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        new_user = SignUPSerializer(data=request.data)
        new_user.is_valid(raise_exception=True)
        user = new_user.save()

        user_data = get_authenticated_user_data(user)

        return Response(user_data, status=201)