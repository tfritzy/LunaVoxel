using System;

public static class RandomNameGenerator
{
    private static readonly string[] Adjectives = {
        "Swift", "Brave", "Clever", "Mighty", "Silent", "Golden", "Fierce", "Noble",
        "Quick", "Bold", "Wise", "Strong", "Gentle", "Wild", "Calm", "Bright",
        "Dark", "Ancient", "Mystic", "Sacred", "Royal", "Proud", "Free", "Lucky",
        "Happy", "Curious", "Playful", "Graceful", "Elegant", "Majestic"
    };

    private static readonly string[] Animals = {
        "Wolf", "Eagle", "Tiger", "Bear", "Fox", "Lion", "Hawk", "Deer",
        "Rabbit", "Owl", "Dragon", "Horse", "Dolphin", "Panther", "Falcon",
        "Lynx", "Otter", "Raven", "Shark", "Turtle", "Whale", "Leopard",
        "Jaguar", "Elk", "Bison", "Crane", "Swan", "Viper", "Cobra", "Phoenix"
    };

    private static readonly Random _random = new Random();

    public static string GenerateName()
    {
        string adjective = Adjectives[_random.Next(Adjectives.Length)];
        string animal = Animals[_random.Next(Animals.Length)];
        return $"{adjective} {animal}";
    }
}