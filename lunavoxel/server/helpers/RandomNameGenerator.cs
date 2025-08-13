using System;

public static class RandomNameGenerator
{
    private static readonly string[] Adjectives = {
        "Stealthy", "Shadowy", "Covert", "Veiled", "Masked", "Mysterious", "Incognito",
        "Silent", "Camouflaged", "Disguised", "Anonymous", "Cloaked", "Ghostly", "Concealed",
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