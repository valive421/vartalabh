

# Vartalabh

A full-stack chat and video call application built with React Native (frontend) and Django (backend).

# App now live
## Download from 
https://github.com/valive421/vartalabh/releases/tag/varta

## Features
- Real-time chat messaging
- Video call signaling and connection
- Friend requests and management
- User authentication (JWT)
- Profile thumbnails and avatars
- Online/offline status updates
- Responsive mobile UI (Android/iOS)

## Technologies Used
- **Frontend:** React Native, React Navigation, Hermes JS engine
- **Backend:** Django, Django Channels, Django REST Framework, Simple JWT
- **Database:** SQLite (default, can be changed)
- **Mobile:** Android (Gradle)


## Demo



https://github.com/user-attachments/assets/479d32d5-8fed-4ba9-a202-c8d7c0ea5849



## Project Structure

```
app/
├── chat/         # React Native frontend
│   ├── src/      # Screens, components, assets, core logic
│   ├── android/  # Android project files
│   ├── ios/      # iOS project files
│   ├── App.tsx   # Main app component
│   ├── index.js  # Entry point
│   ├── package.json
│   └── ...
├── core/         # Django backend
│   ├── main/     # Django app: models, views, consumers, routing
│   ├── core/     # Django project: settings, urls, wsgi/asgi
│   ├── manage.py # Django management script
│   ├── requirements.txt
│   └── ...
```


## REST API Endpoints

| Endpoint                | Method | Description                       |
|-------------------------|--------|-----------------------------------|
| `/api/signin/`          | POST   | User sign-in (returns user & tokens) |
| `/api/token/refresh/`   | POST   | Refresh JWT access token          |
| `/api/user/`            | GET    | Get current user info             |
| `/api/user/<username>/` | GET    | Get user info by username         |
| `/api/thumbnail/`       | POST   | Upload/change user thumbnail (base64) |


> **Note:** Most endpoints require authentication via JWT token.

---

## WebSocket Routes

### Chat WebSocket

- **URL:** `ws://<host>/chat/?token=<access_token>`

#### Supported `source` messages (JSON):

| Source             | Direction      | Description                                 | Payload Example / Notes                |
|--------------------|---------------|---------------------------------------------|----------------------------------------|
| `search`           | client → server | Search for users                            | `{ "source": "search", "query": "..." }` |
| `thumbnail`        | client → server | Upload/change user thumbnail (base64)        | `{ "source": "thumbnail", "base64": "...", "filename": "..." }` |
| `request.accept`   | server → client | Friend request accepted                     | `{ "source": "request.accept", "data": {request} }` |
| `request.list`     | server → client | List of pending requests                    | `{ "source": "request.list", "data": [request, ...] }` |
| `friend.list`      | server → client | List of friends                             | `{ "source": "friend.list", "data": [friend, ...] }` |
| `message.send`     | server → client | New message (to both sender & receiver)     | `{ "source": "message.send", "data": {message} }` |
| `message.list`     | server → client | List of messages                            | `{ "source": "message.list", "data": {messages: [...], next: ...} }` |
| `message.typing`   | server → client | Typing indicator                            | `{ "source": "message.typing", "data": {...} }` |
| `message.read`     | server → client | Message read event                          | `{ "source": "message.read", "data": {message_id: 123, status: "read"} }` |
| `user.status`      | server → client | Friend online/offline status                | `{ "source": "user.status", "data": {username: "...", online: true/false} }` |
| `ping`             | client → server | Keepalive ping                              | `{ "source": "ping" }`                 |
| `pong`             | server → client | Keepalive pong                              | `{ "source": "pong" }`                 |

---

### Video Call WebSocket

- **URL:** `ws://<host>/ws/video/?token=<access_token>`

#### Supported `action` messages (JSON):

| Action      | Direction         | Description                        | Payload Example / Notes                |
|-------------|-------------------|------------------------------------|----------------------------------------|
| `call`      | client → server   | Initiate a call                    | `{ "action": "call", "recipient": "target_username" }` |
| `call`      | server → client   | Incoming call notification         | `{ "action": "call", "caller": "...", "recipient": "...", "recipient_online": true/false }` |
| `offer`     | client/server ↔   | WebRTC offer SDP                   | `{ "action": "offer", "recipient": "...", "offer": {...} }` |
| `answer`    | client/server ↔   | WebRTC answer SDP                  | `{ "action": "answer", "recipient": "...", "answer": {...} }` |
| `candidate` | client/server ↔   | WebRTC ICE candidate               | `{ "action": "candidate", "recipient": "...", "candidate": {...} }` |
| `accept`    | client/server ↔   | Accept incoming call               | `{ "action": "accept", "recipient": "..." }` |
| `decline`   | client/server ↔   | Decline incoming call              | `{ "action": "decline", "recipient": "..." }` |
| `end-call`  | client/server ↔   | End the call                       | `{ "action": "end-call", "recipient": "..." }` |
| `ping`      | client → server   | Keepalive                          | `{ "action": "ping" }`                 |
| `connection_success` | server → client | Connection established         | `{ "action": "connection_success", ... }` |

---

## Getting Started

### Backend (Django)
1. Install Python dependencies:
   ```
   pip install -r core/requirements.txt
   ```
2. Run migrations:
   ```
   python core/manage.py migrate
   ```
3. Start the backend server:
   ```
   python core/manage.py runserver
   ```

### Frontend (React Native)
1. Install Node dependencies:
   ```
   cd chat
   npm install
   ```
2. Start Metro bundler:
   ```
   npm start
   ```
3. Run on Android:
   ```
   npm run android
   ```

## Environment Variables
- Configure Django settings in `core/core/settings.py` as needed.
- For media uploads, ensure `MEDIA_URL` and `MEDIA_ROOT` are set.

## Usage
- Register and sign in via the mobile app.
- Add friends, send messages, and initiate video calls.
- Profile images are stored in `media/thumbnails/`.

## Testing
- Backend: Run Django tests with `python core/manage.py test`
- Frontend: Run Jest tests with `npm test` in `chat/`

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## Troubleshooting
- If Metro bundler fails, restart it in the `chat` directory.
- For missing dependencies, check `requirements.txt` and `package.json`.
- For Android build issues, ensure all native dependencies are installed.

## Credits
- React Native documentation: https://reactnative.dev/
- Django documentation: https://docs.djangoproject.com/
- Django Channels: https://channels.readthedocs.io/
