"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT refresh endpoint
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # App APIs (JWT-based endpoints live under accounts/)
    # FE expects:
    # - /api/auth/register/
    # - /api/auth/login/
    # - /api/auth/me/
    path('api/auth/', include('accounts.urls')),

    path('api/study/', include('study.urls')),
    path('api/productivity/', include('productivity.urls')),
    path('api/ai/', include('ai.urls')),
    path('api/burnout/', include('burnout.urls')),
    path('api/quiz/', include('quiz.urls')),
]
