using Azure;
using Azure.AI.OpenAI;
using Microsoft.CognitiveServices.Speech;

namespace AIEnglishTeacher.Core.Services
{
    public class AIService
    {
        private readonly string _speechKey;
        private readonly string _speechRegion;
        private readonly string _openAIEndpoint;
        private readonly string _openAIKey;

        public AIService(string speechKey, string speechRegion, string openAIEndpoint, string openAIKey)
        {
            _speechKey = speechKey;
            _speechRegion = speechRegion;
            _openAIEndpoint = openAIEndpoint;
            _openAIKey = openAIKey;
        }

        public async Task<string> RecognizeSpeechAsync()
        {
            var config = SpeechConfig.FromSubscription(_speechKey, _speechRegion);
            SpeechRecognitionResult result;

            using (var recognizer = new SpeechRecognizer(config))
            {
                Console.WriteLine("Say something...");
                result = await recognizer.RecognizeOnceAsync();

                if (result.Reason == ResultReason.RecognizedSpeech)
                {
                    Console.WriteLine($"We recognized: {result.Text}");
                }
                else if (result.Reason == ResultReason.NoMatch)
                {
                    Console.WriteLine($"NOMATCH: Speech could not be recognized.");
                }
                else if (result.Reason == ResultReason.Canceled)
                {
                    var cancellation = CancellationDetails.FromResult(result);
                    Console.WriteLine($"CANCELED: Reason={cancellation.Reason}");

                    if (cancellation.Reason == CancellationReason.Error)
                    {
                        Console.WriteLine($"CANCELED: ErrorCode={cancellation.ErrorCode}");
                        Console.WriteLine($"CANCELED: ErrorDetails={cancellation.ErrorDetails}");
                        Console.WriteLine($"CANCELED: Did you update the subscription info?");
                    }
                }
            }
            return result.Text;
        }

        public async Task SynthesisToSpeakerAsync(string text)
        {
            if (Environment.OSVersion.Platform == PlatformID.Win32NT)
            {
                Console.InputEncoding = System.Text.Encoding.Unicode;
                Console.OutputEncoding = System.Text.Encoding.Unicode;
            }

            var config = SpeechConfig.FromSubscription(_speechKey, _speechRegion);
            config.SpeechSynthesisVoiceName = "en-US-AriaNeural";

            using (var synthesizer = new SpeechSynthesizer(config))
            {
                using (var result = await synthesizer.SpeakTextAsync(text))
                {
                    if (result.Reason == ResultReason.SynthesizingAudioCompleted)
                    {
                        //Console.WriteLine($"Speech synthesized to speaker for text [{text}]");
                    }
                    else if (result.Reason == ResultReason.Canceled)
                    {
                        var cancellation = SpeechSynthesisCancellationDetails.FromResult(result);
                        Console.WriteLine($"CANCELED: Reason={cancellation.Reason}");

                        if (cancellation.Reason == CancellationReason.Error)
                        {
                            Console.WriteLine($"CANCELED: ErrorCode={cancellation.ErrorCode}");
                            Console.WriteLine($"CANCELED: ErrorDetails=[{cancellation.ErrorDetails}]");
                            Console.WriteLine($"CANCELED: Did you update the subscription info?");
                        }
                    }
                }
            }
        }

        public async Task<string> ChatWithAIAsync(List<ChatMessage> messages)
        {
            var client = new OpenAIClient(
                new Uri(_openAIEndpoint),
                new AzureKeyCredential(_openAIKey));

            var chatCompletionOptions = new ChatCompletionsOptions();

            foreach (var message in messages)
            {
                chatCompletionOptions.Messages.Add(message);
            }

            chatCompletionOptions.Temperature = 0.0f;
            chatCompletionOptions.FrequencyPenalty = 0.0f;
            chatCompletionOptions.PresencePenalty = 0.0f;
            chatCompletionOptions.MaxTokens = 800;
            chatCompletionOptions.NucleusSamplingFactor = 0.95f;

            var completionsResponse = await client.GetChatCompletionsAsync(
                deploymentOrModelName: "TestGPT",
                chatCompletionOptions);

            return completionsResponse.Value.Choices[0].Message.Content;
        }
    }
} 