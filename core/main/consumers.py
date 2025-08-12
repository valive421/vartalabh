from asgiref.sync import async_to_sync
from channels.generic.websocket import AsyncWebsocketConsumer
import json
import base64
from django.core.files.base import ContentFile
from .serializer import UserSerializer , SearchSerializer , RequestSerializer , FriendListSerializer , MessageSerializer
from asgiref.sync import sync_to_async
from asgiref.sync import async_to_sync
from .models import User , Connection , Message
from django.db.models import Q , Exists, OuterRef
from channels.layers import get_channel_layer

# ...existing code...
class VideoCallConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        print(f"[VideoCallConsumer] Connecting for user: {getattr(self.user, 'username', None)}")
        if not self.user or not self.user.is_authenticated:
            print("[VideoCallConsumer] User is not authenticated, closing connection")
            await self.close()
            return
        
        # FIX: Normalize username to lowercase
        self.username = self.user.username
        normalized_username = self.username.lower()
        print(f"[VideoCallConsumer] Joining personal group: {normalized_username}")
        # Use a dedicated group for video signaling to avoid conflicts with ChatConsumer
        self.video_group = f"video_{normalized_username}"

        # Add user to their dedicated video signaling group
        await self.channel_layer.group_add(
            self.video_group,
            self.channel_name
        )

        await self.accept()
        print(f"[VideoCallConsumer] Accepted connection for user: {self.username}")

        # Send connection success message
        await self.send(text_data=json.dumps({
            "action": "connection_success",
            "message": "WebSocket connection established",
            "username": self.username,
            "group": self.video_group
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'video_group'):
            # Remove user from their video group
            await self.channel_layer.group_discard(
                self.video_group,
                self.channel_name
            )

    async def receive(self, text_data):
        print(f"[VideoCallConsumer] Received WebSocket message: {text_data}")
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                "action": "error",
                "message": "Invalid JSON format"
            }))
            return
        try:
            action = data.get('action')
            print(f"[VideoCallConsumer] Parsed action: {action}, data: {data}")

            if action == 'ping':
                await self.send(text_data=json.dumps({'action': 'pong'}))
                return

            if not action:
                await self.send(text_data=json.dumps({
                    "action": "error",
                    "message": "Missing action field"
                }))
                return

            recipient_username = data.get('recipient')
            print(f"[VideoCallConsumer] Recipient username: {recipient_username}")

            if not recipient_username:
                await self.send(text_data=json.dumps({
                    "action": "error",
                    "message": "Missing recipient field"
                }))
                return

            recipient = await self.get_user(recipient_username)
            print(f"[VideoCallConsumer] Recipient user object: {recipient}")

            if not recipient:
                await self.send(text_data=json.dumps({
                    "action": "error",
                    "message": "Recipient not found"
                }))
                return

            if action == 'call':
                print(f"[VideoCallConsumer] Handling call from {self.user.username} to {recipient_username}")
                await self.handle_call(recipient_username)
            elif action in ['offer', 'answer', 'candidate', 'accept', 'decline', 'end-call']:
                if not data.get(action) and action not in ['accept', 'decline', 'end-call']:
                    await self.send(text_data=json.dumps({
                        "action": "error",
                        "message": f"Missing {action} field"
                    }))
                    return

                print(f"[VideoCallConsumer] Forwarding signal: {action} to {recipient_username}")
                await self.forward_signal(data, recipient_username)
            else:
                await self.send(text_data=json.dumps({
                    "action": "error",
                    "message": "Invalid action"
                }))
        except Exception as e:
            print(f"[VideoCallConsumer] Exception: {str(e)}")
            await self.send(text_data=json.dumps({
                "action": "error",
                "message": str(e)
            }))

    # --- Added/Updated: Handle initiating a call and broadcast proper signal ---
    async def handle_call(self, recipient_username):
        # FIX: Use normalized username for recipient lookup
        normalized_recipient = recipient_username.lower()
        print(f"[VideoCallConsumer] Sending call signal to: {normalized_recipient}")
        await self.channel_layer.group_send(
            f"video_{normalized_recipient}",
            {
                "type": "call.signal",
                "action": "call",
                "caller": self.user.username,
                "recipient": recipient_username,
                "recipient_online": normalized_recipient in ONLINE_USERS,
            }
        )

    # Handle delivery of call.signal to the recipient client
    async def call_signal(self, event):
        try:
            payload = {
                "action": "call",
                "caller": event.get("caller"),
                "recipient": event.get("recipient"),
                "recipient_online": event.get("recipient_online", False),
            }
            await self.send(text_data=json.dumps(payload))
        except Exception as e:
            print(f"[VideoCallConsumer] call_signal error: {e}")

    async def forward_signal(self, data, recipient_username):
        # FIX: Normalize recipient to lowercase
        normalized_recipient = recipient_username.lower()
        data_to_send = {
            **data,
            "sender": self.user.username,
            "timestamp": self.get_timestamp()
        }
        
        await self.channel_layer.group_send(
            f"video_{normalized_recipient}",
            {
                "type": "webrtc.signal",  # Changed from "signal" to "webrtc.signal"
                **data_to_send
            }
        )

    # (removed duplicate call_signal that forwarded raw event)

    async def webrtc_signal(self, event):
        print(f"[VideoCallConsumer] webrtc_signal for user={getattr(self, 'username', None)} event={ {k:v for k,v in event.items() if k!='type'} }")
        await self.send(text_data=json.dumps({ k: v for k, v in event.items() if k != 'type' }))

    @sync_to_async
    def get_user(self, username):
        try:
            return User.objects.get(username=username)
        except User.DoesNotExist:
            return None

    def get_timestamp(self):
        from datetime import datetime
        return datetime.now().isoformat()

    async def broadcast_group(self, event):
        event.pop('type', None)
        await self.send(text_data=json.dumps(event))

ONLINE_USERS = set()

class ChatConsumer(AsyncWebsocketConsumer):
    async def call_signal(self, event):
        print(f"[ChatConsumer] call_signal received (ignored). event={ {k:v for k,v in event.items() if k!='type'} }")
        return

    async def webrtc_signal(self, event):
        print(f"[ChatConsumer] webrtc_signal received (ignored). event={ {k:v for k,v in event.items() if k!='type'} }")
        return

    async def receive_message_read(self, data):
        user = self.scope.get('user')
        message_id = data.get('message_id')
        print(f'[DEBUG] receive_message_read called by user: {getattr(user, "username", None)}, message_id: {message_id}')
        try:
            def mark_message_read():
                message = Message.objects.filter(id=message_id).first()
                if not message:
                    print(f'[DEBUG] Message not found for id: {message_id}')
                    return None, None
                # Only receiver can mark as read
                if message.sender == user:
                    print(f'[DEBUG] Sender cannot mark own message as read. user: {getattr(user, "username", None)}')
                    return None, None
                if message.status != 'read':
                    message.status = 'read'
                    message.save()
                    sender_username = message.sender.username
                    print(f'[DEBUG] Message {message_id} marked as read by {getattr(user, "username", None)}')
                    return message.id, sender_username
                print(f'[DEBUG] Message {message_id} already marked as read')
                return None, None
            msg_id, sender_username = await sync_to_async(mark_message_read)()
            if msg_id and sender_username:
                print(f'[DEBUG] Sending message.read event to sender: {sender_username} for message_id: {msg_id}')
                await self.send_group(sender_username, 'message.read', {'message_id': msg_id, 'status': 'read'})
        except Exception as e:
            print(f"Error marking message as read: {str(e)}")
    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            print("User is not authenticated, closing connection")
            await self.close()
            return
        self.username = user.username
        await self.channel_layer.group_add(
            self.username, self.channel_name
        )
        await self.accept()
        print("WebSocket connection established")
        ONLINE_USERS.add(self.username)
        await self.broadcast_status(self.username, True)

        # Mark all 'sent' messages as 'delivered' for this user and notify senders
        def mark_all_sent_as_delivered():
            delivered = []
            # Find all connections where user is receiver
            connections = Connection.objects.filter(receiver=user, accepted=True)
            for conn in connections:
                msgs = Message.objects.filter(connection=conn, status='sent')
                for msg in msgs:
                    msg.status = 'delivered'
                    msg.save()
                    delivered.append((msg.id, msg.sender.username))
            return delivered
        delivered_msgs = await sync_to_async(mark_all_sent_as_delivered)()
        # Notify senders in real time
        for msg_id, sender_username in delivered_msgs:
            await self.send_group(sender_username, 'message.delivered', {'message_id': msg_id, 'status': 'delivered'})

    async def disconnect(self, close_code):
        # Guard against missing username (e.g., auth failed before connect)
        username = getattr(self, 'username', None)
        if not username:
            print("[ChatConsumer] disconnect called without authenticated username; skipping group cleanup")
            return
        try:
            await self.channel_layer.group_discard(
                username, self.channel_name
            )
        except Exception as e:
            print(f"[ChatConsumer] Error discarding group for {username}: {e}")
        print("WebSocket connection closed")
        # Mark user as offline
        ONLINE_USERS.discard(username)
        await self.broadcast_status(username, False)

    async def broadcast_status(self, username, online):
        # Notify all friends about this user's status
        try:
            user = await sync_to_async(User.objects.get)(username=username)
            # Find all connections where this user is sender or receiver and accepted
            connections = await sync_to_async(lambda: list(
                Connection.objects.filter(
                    Q(sender=user) | Q(receiver=user),
                    accepted=True
                ).select_related('sender', 'receiver')
            ))()
            # Get all friend usernames
            friend_usernames = set()
            for conn in connections:
                if conn.sender.username != username:
                    friend_usernames.add(conn.sender.username)
                if conn.receiver.username != username:
                    friend_usernames.add(conn.receiver.username)
            # Broadcast status to each friend
            for friend_username in friend_usernames:
                await self.send_group(
                    friend_username,
                    'user.status',
                    {'username': username, 'online': online}
                )
        except Exception as e:
            print(f"Error broadcasting status: {str(e)}")

    async def receive(self, text_data):
        data = json.loads(text_data)
        data_source = data.get('source')
        print('receive', data_source, data)

        if data_source == 'search':
            # handle user search
            await self.receive_search(data)

        elif data_source == 'thumbnail':
            # handle thumbnail upload
            await self.receive_thumbnail(data)

        elif data_source == 'request.accept':
            # handle request accept
            await self.receive_request_accept(data)

        elif data_source == 'request.connect':
            # handle request connect
            await self.receive_request_connect(data)
        elif data_source == 'request.list':
            # handle request list
            await self.receive_request_list(data)
        elif data_source == 'friend.list':
            # handle Friend list
            await self.receive_friend_list(data)
        elif data_source == 'message.send':
            # handle message send
            await self.receive_message_send(data)
        elif data_source == 'message.list':
            # handle message list
            await self.receive_message_list(data)
        elif data_source == 'message.typing':
            # handle message typing
            await self.receive_message_typing(data)
        elif data_source == 'message.read':
            # handle message read
            await self.receive_message_read(data)

    async def receive_search(self, data):
        query = data.get('query')
        # run DB query in thread, including annotate
        def get_users_with_status():
            return list(
                User.objects.filter(
                    Q(username__icontains=query) |
                    Q(last_name__icontains=query) |
                    Q(first_name__icontains=query)
                ).exclude(
                    username=self.scope.get('user').username
                ).annotate(
                    pending_them = Exists(
                        Connection.objects.filter(
                            sender=self.scope.get('user'),
                            receiver=OuterRef('pk'),
                            accepted=False
                        )
                    ),
                    pending_me = Exists(
                        Connection.objects.filter(
                            receiver=self.scope.get('user'),
                            sender=OuterRef('pk'),
                            accepted=False
                        )
                    ),
                    connected = Exists(
                        Connection.objects.filter(
                            Q(sender=self.scope.get('user'), receiver=OuterRef('pk'), accepted=True) |
                            Q(receiver=self.scope.get('user'), sender=OuterRef('pk'), accepted=True),
                            accepted=True
                        )
                    )
                )
            )
        users = await sync_to_async(get_users_with_status)()
        serialized_users = SearchSerializer(users, many=True)
        
        # broadcast search results
        await self.send_group(
            self.username,
            'search',
            serialized_users.data
        )

    async def receive_thumbnail(self, data):
        user = self.scope.get('user')
        image_str = data.get('base64')
        image = ContentFile(base64.b64decode(image_str))
        filename = data.get('filename')
        unique_filename = f"{user.id}_{filename.lstrip('/')}"
        # delete old thumbnail
        if user.thumbnail:
            await sync_to_async(user.thumbnail.delete)(save=False)
        print(f"Saving thumbnail to: thumbnails/{unique_filename}")
        # save new thumbnail
        await sync_to_async(user.thumbnail.save)(unique_filename, image, save=True)
        await sync_to_async(user.refresh_from_db)()
        serialized = UserSerializer(user)
        print("Thumbnail URL returned to frontend:", serialized.data.get("thumbnail"))
        # broadcast new thumbnail
        await self.send_group(
            self.username,
            'thumbnail',
            serialized.data
        )

    async def send_group(self, group, source, data):
        response = {
            'type': 'broadcast_group',
            'source': source,
            'data': data
        }
        # send to group
        await self.channel_layer.group_send(
            group,
            response
        )

    async def broadcast_group(self, data):
        data.pop('type')
        # send to client
        await self.send(text_data=json.dumps({ **data }))

    async def receive_request_connect(self, data):
        username = data.get('username')
        #attempt to find recv user
        try:
            receiver = await sync_to_async(User.objects.get)(username=username)
        except User.DoesNotExist:
            print(f"User {username} does not exist")
            return
        # create a connection request
        connection, _ = await sync_to_async(Connection.objects.get_or_create)(
            sender=self.scope.get('user'),
            receiver=receiver
        )
        serialized = RequestSerializer(connection)
        # get sender and receiver usernames asynchronously
        sender_username = await sync_to_async(lambda: connection.sender.username)()
        receiver_username = await sync_to_async(lambda: connection.receiver.username)()
        #send back to sender
        await self.send_group(
            sender_username,
            'request.connect',
            serialized.data
        )
        #send back to receiver
        await self.send_group(
            receiver_username,
            'request.connect',
            serialized.data
        )

    async def receive_request_list(self, data):
        user = self.scope.get('user')
        # get all connections for the user (received or sent, not accepted)
        connections = await sync_to_async(lambda: list(
            Connection.objects.filter(
                Q(receiver=user) | Q(sender=user),
                accepted=False
            ).select_related('sender', 'receiver')
        ))()
        # fetch all related objects in thread to avoid sync DB access during serialization
        serialized = await sync_to_async(lambda: RequestSerializer(connections, many=True).data)()
        # send back to user
        await self.send_group(
            user.username,
            'request.list',
            serialized
        )

    async def receive_request_accept(self, data):
        username = data.get('username')
        # wrap DB access in sync_to_async
        async def get_connection():
            # fetch related objects in thread to avoid sync DB access during serialization
            return await sync_to_async(
                lambda: Connection.objects.select_related('sender', 'receiver').filter(
                    sender__username=username,
                    receiver=self.scope.get('user')
                ).order_by('-id').first()  # get the latest connection
            )()
        connection = await get_connection()
        if not connection:
            print(f"No connection found for {username}")
            return
        # update connection to accepted
        connection.accepted = True
        await sync_to_async(connection.save)()
        # serialize in thread to avoid sync DB access
        serialized = await sync_to_async(lambda: RequestSerializer(connection).data)()
        sender_username = await sync_to_async(lambda: connection.sender.username)()
        receiver_username = await sync_to_async(lambda: connection.receiver.username)()
        await self.send_group(sender_username, 'request.accept', serialized)
        await self.send_group(receiver_username, 'request.accept', serialized)


    async def receive_friend_list(self, data):
        user = self.scope.get('user')
        # Fix the database query - should get connections where user is either sender or receiver
        connections = await sync_to_async(lambda: list(
            Connection.objects.filter(
                Q(sender=user) | Q(receiver=user),
                accepted=True
            ).select_related('sender', 'receiver')
        ))()
        
        # Serialize in thread to avoid sync DB access
        serialized_data = await sync_to_async(
            lambda: FriendListSerializer(connections, context={"user": user}, many=True).data
        )()
        
        # Add online status to each friend
        for item in serialized_data:
            friend_username = item.get('friend', {}).get('username')
            item['online'] = friend_username in ONLINE_USERS
        # send back to user - pass .data instead of serializer object
        await self.send_group(user.username, 'friend.list', serialized_data)

    async def receive_message_send(self, data):
        user = self.scope.get('user')
        connection_id = data.get('connection_id')
        text = data.get('text')

        print(f"Attempting to send message for connection_id: {connection_id}, text: {text}")

        try:
            connection = await sync_to_async(lambda: Connection.objects.filter(id=connection_id).first())()
            if not connection:
                print(f"No connection found with id {connection_id}")
                return

            # Create a new message with status 'sent'
            message = await sync_to_async(lambda: Message.objects.create(
                connection=connection,
                sender=user,
                text=text,
                status='sent'
            ))()

            # Determine who is the other user in this conversation
            other_user = await sync_to_async(lambda: connection.receiver if connection.sender == user else connection.sender)()


            # Mark as delivered only if receiver is online
            def mark_delivered_if_online():
                if message.sender != other_user and message.status == 'sent':
                    if other_user.username in ONLINE_USERS:
                        message.status = 'delivered'
                        message.save()
                return message
            delivered_message = await sync_to_async(mark_delivered_if_online)()

            # Serialize in thread to avoid sync DB access
            serialized = await sync_to_async(lambda: MessageSerializer(delivered_message).data)()

            # Send to both participants
            await self.send_group(user.username, 'message.send', serialized)
            await self.send_group(other_user.username, 'message.send', serialized)

            # Send delivered event to sender only if delivered
            if delivered_message.status == 'delivered':
                await self.send_group(user.username, 'message.delivered', {'message_id': delivered_message.id, 'status': 'delivered'})

        except Connection.DoesNotExist:
            print(f"Connection with id {connection_id} does not exist")
        except Exception as e:
            print(f"Error sending message: {str(e)}")

    async def receive_message_list(self, data):
        user = self.scope.get('user')
        connection_id = data.get('connection_id')
        next_page = data.get('next')
        
        try:
            # Get connection
            connection = await sync_to_async(lambda: Connection.objects.filter(id=connection_id).first())()
            if not connection:
                print(f"No connection found with id {connection_id}")
                return
                
            # Get and update messages in a single sync_to_async lambda
            PAGE_SIZE = 20
            def get_and_update_messages():
                # If next_page is provided, use it as an offset
                offset = 0
                if next_page:
                    try:
                        offset = int(next_page)
                    except Exception:
                        offset = 0
                messages = list(Message.objects.filter(connection=connection).order_by('-created')[offset:offset+PAGE_SIZE])
                delivered_ids = []
                sender_usernames = []
                for msg in messages:
                    if msg.sender != user and msg.status == 'sent':
                        if user.username in ONLINE_USERS:
                            msg.status = 'delivered'
                            msg.save()
                            delivered_ids.append(msg.id)
                            sender_usernames.append(msg.sender.username)
                # Re-fetch after status update
                messages = list(Message.objects.filter(connection=connection).order_by('-created')[offset:offset+PAGE_SIZE])
                # Calculate next token
                total_count = Message.objects.filter(connection=connection).count()
                next_token = None
                if offset + PAGE_SIZE < total_count:
                    next_token = str(offset + PAGE_SIZE)
                return messages, delivered_ids, sender_usernames, next_token

            messages_list, delivered_ids, sender_usernames, next_token = await sync_to_async(get_and_update_messages)()

            serialized_messages = await sync_to_async(lambda: MessageSerializer(messages_list, many=True).data)()
            result = {
                'messages': serialized_messages,
                'next': next_token
            }
            await self.send_group(user.username, 'message.list', result)

            # Send real-time delivered event to sender(s)
            for msg_id, sender_username in zip(delivered_ids, sender_usernames):
                await self.send_group(sender_username, 'message.delivered', {'message_id': msg_id, 'status': 'delivered'})
            
        except Exception as e:
            print(f"Error fetching messages: {str(e)}")

    async def receive_message_typing(self, data):
        user = self.scope.get('user')
        target_username = data.get('username')
        try:
            # Find connection where user is either sender or receiver and target is the other
            connection = await sync_to_async(lambda: Connection.objects.filter(
                (Q(sender=user, receiver__username=target_username) | Q(receiver=user, sender__username=target_username)),
                accepted=True
            ).order_by('-id').first())()
            if not connection:
                print(f"No active connection found for typing indicator between {user.username} and {target_username}")
                return

            # Only send typing indicator to the receiver (not to the sender)
            receiver = await sync_to_async(lambda: connection.receiver if connection.sender == user else connection.sender)()
            if receiver.username == target_username:
                await self.send_group(
                    receiver.username,
                    'message.typing',
                    {
                        'username': user.username,
                        'connection_id': connection.id
                    }
                )
        except Exception as e:
            print(f"Error in typing indicator: {str(e)}")