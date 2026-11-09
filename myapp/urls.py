from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('projects/', views.projects, name='projects'),
    path('quote/', views.quote, name='quote'),
    path('contact/', views.contact, name='contact'),
    path('lawn-care/', views.lawn_care, name='lawn-care'),
    
]