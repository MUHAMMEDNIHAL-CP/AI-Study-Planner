from django.urls import path

from .views import LoginView, MeView, RegisterView, SocialLoginView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('social/', SocialLoginView.as_view(), name='social_login'),
    path('me/', MeView.as_view(), name='me'),
]
