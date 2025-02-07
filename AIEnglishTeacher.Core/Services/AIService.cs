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
            // 使用 OpenAI.Program 中的实现
            return await OpenAI.Program.RecognizeSpeechAsync();
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