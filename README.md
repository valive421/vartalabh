

# Vartalabh

A full-stack chat and video call application built with React Native (frontend) and Django (backend).


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
- **Mobile:** Android (Gradle), iOS (Xcode)


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
4. Run on iOS (Mac only):
   ```
   npm run ios
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

## License
This project is licensed under the MIT License.

## Troubleshooting
- If Metro bundler fails, restart it in the `chat` directory.
- For missing dependencies, check `requirements.txt` and `package.json`.
- For Android/iOS build issues, ensure all native dependencies are installed.

## Credits
- React Native documentation: https://reactnative.dev/
- Django documentation: https://docs.djangoproject.com/
- Django Channels: https://channels.readthedocs.io/
