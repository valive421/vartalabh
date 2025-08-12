from mailbox import Message
from rest_framework import serializers
from .models import User , Connection , Message

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [ 'username', 'first_name', 'last_name', 'thumbnail' ]

class SignUPSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [ 'username', 'password', 'first_name', 'last_name', 'thumbnail' ]
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            thumbnail=validated_data.get('thumbnail', None)
        )
        return user

class SearchSerializer(UserSerializer):
    status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = UserSerializer.Meta.fields + ['status']

    def get_status(self, obj):
        if obj.pending_them:
            return 'pending_them'
        elif obj.pending_me:
            return 'pending_me'
        elif obj.connected:
            return 'connected'
        return 'no connection'
    

class RequestSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)

    class Meta:
        model = Connection
        fields = ["id",'sender', 'receiver', 'accepted', 'created', 'updated']


class FriendListSerializer(serializers.ModelSerializer):
    friend = serializers.SerializerMethodField()
    preview = serializers.SerializerMethodField()

    class Meta:
        model = Connection
        fields = ['id', 'friend', 'preview', 'updated']

    def get_friend(self, obj):
        if self.context.get("user") == obj.sender:
            return UserSerializer(obj.receiver).data
        return UserSerializer(obj.sender).data

    def get_preview(self, obj):
        # Get the latest message in this connection, regardless of sender
        last_message = (
            Message.objects
            .filter(connection=obj)
            .order_by('-created')
            .first()
        )
        if last_message:
            return last_message.text
        return ""

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'connection', 'sender', 'text', 'created', 'status']