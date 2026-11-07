from django.shortcuts import render

# Create your views here.
def home(request):
    return render(request, 'index.html')
def projects(request):
    return render(request, 'projects.html')
def quote(request):
    return render(request, 'quote.html')
def contact(request):
    return render(request, 'contact.html')
def lawn_care(request):
    return render(request, 'lawn-care.html')

