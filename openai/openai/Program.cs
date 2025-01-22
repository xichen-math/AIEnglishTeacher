// Note: the Azure OpenAI client library for .NET is in preview.
// Install the .NET library via NuGet: dotnet add package Azure.AI.OpenAI --version 1.0.0-beta.5 
using Azure;
using Azure.AI.OpenAI;
using Azure.Identity;
using Microsoft.CognitiveServices.Speech;
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Net;
//ing Aspose.Slides;
using System.Drawing.Imaging;
using System.Windows.Forms;
using Microsoft.Identity.Client;
using System.Diagnostics.Tracing;
//using Microsoft.Office.Interop.PowerPoint;
using System.Runtime.InteropServices;
//using Microsoft.Office.Core;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Presentation;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Drawing;
using Microsoft.Office.Interop.PowerPoint;

namespace OpenAI
{
    class Program
    {

        public static async Task<string> RecognizeSpeechAsync()
        {
            // Creates an instance of a speech config with specified subscription key and service region.
            // Replace with your own subscription key // and service region (e.g., "westus").
            var config = SpeechConfig.FromSubscription("bd5f339e632b4544a1c9a300f80c1b0a", "eastus");
            SpeechRecognitionResult result;

            using (var recognizer = new SpeechRecognizer(config))
            {
                Console.WriteLine("Say something...");

                // Starts speech recognition, and returns after a single utterance is recognized. The end of a
                // single utterance is determined by listening for silence at the end or until a maximum of 15
                // seconds of audio is processed.  The task returns the recognition text as result. 
                // Note: Since RecognizeOnceAsync() returns only a single utterance, it is suitable only for single
                // shot recognition like command or query. 
                // For long-running multi-utterance recognition, use StartContinuousRecognitionAsync() instead.
                 result = await recognizer.RecognizeOnceAsync();

                // Checks result.
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

        public static async Task SynthesisToSpeakerAsync(string text)
        {
            // To support Chinese Characters on Windows platform
            if (Environment.OSVersion.Platform == PlatformID.Win32NT)
            {
                Console.InputEncoding = System.Text.Encoding.Unicode;
                Console.OutputEncoding = System.Text.Encoding.Unicode;
            }

            // Creates an instance of a speech config with specified subscription key and service region.
            // Replace with your own subscription key and service region (e.g., "westus").
            // The default language is "en-us".
            var config = SpeechConfig.FromSubscription("bd5f339e632b4544a1c9a300f80c1b0a", "eastus");

            // Set the voice name, refer to https://aka.ms/speech/voices/neural for full list.
            config.SpeechSynthesisVoiceName = "en-US-AriaNeural";

            // Creates a speech synthesizer using the default speaker as audio output.
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

                // This is to give some time for the speaker to finish playing back the audio
                //Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
            }
        }

        //only Azure.AI.OpenAI- 1.0 support followng code
        public static async Task gpt()
        {
            OpenAIClient client = new OpenAIClient(
            new Uri("https://tinyao.openai.azure.com/"),
            new AzureKeyCredential("2d20693670634f3db62e0b89f3a91028"));
            string filePath = @"C:\Users\tinyao\source\repos\openai\OpenAI\Prompt.txt";
            string Promots_Input = string.Empty;

            // Check if the file exists
            if (File.Exists(filePath))
            {
                // Read all text from the file into a single string
                 Promots_Input = File.ReadAllText(filePath);
            }

            // If streaming is not selected
            Response<Completions> completionsResponse = client.GetCompletions(
                "gpt-4",

            new CompletionsOptions()
            {
                
                Prompts = { Promots_Input },
                Temperature = (float)0.1,
                MaxTokens = 1500,
                NucleusSamplingFactor = (float)0.8,
                FrequencyPenalty = (float)1,
                PresencePenalty = (float)0,
            });


            Completions completions = completionsResponse.Value;

            Console.WriteLine(completions.Choices[0].Text);


        }
        
        public static async Task<string> gpt_chat( List<ChatMessage> Messages_History)
        {
            OpenAIClient client = new OpenAIClient(
            new Uri("https://tinyao.openai.azure.com/"),
            new AzureKeyCredential("2d20693670634f3db62e0b89f3a91028"));
            string filePath = @"C:\Users\tinyao\source\repos\openai\OpenAI\Prompt.txt";
            
            var chatCompletionOptions = new ChatCompletionsOptions();

            foreach (var message in Messages_History)
            {
                chatCompletionOptions.Messages.Add(message);
            }

            chatCompletionOptions.Temperature = (float)0.0;
            chatCompletionOptions.FrequencyPenalty = (float)0;
            chatCompletionOptions.PresencePenalty = (float)0;
            chatCompletionOptions.MaxTokens = 800;
            chatCompletionOptions.NucleusSamplingFactor = (float)0.95;


            //chatCompletionOptions.StopSequences.Add("hi");

            // If streaming is not selected
            Response<ChatCompletions> completionsResponse = await client.GetChatCompletionsAsync(
            deploymentOrModelName: "TestGPT", chatCompletionOptions);

            /*new ChatCompletionsOptions()
            {

                Messages = Messages_History,
                Temperature = a,
                MaxTokens = 800,
                NucleusSamplingFactor = (float)0.95,
                FrequencyPenalty = (float)0,
                PresencePenalty = (float)0,
            });*/

            Console.WriteLine("Teacher:"+completionsResponse.Value.Choices[0].Message.Content);
            return completionsResponse.Value.Choices[0].Message.Content;


        }
        /*static void PlaySlide(string filePath, int slideIndexToPlay)
        {
            Application pptApp = new Application();
            Presentation presentation = pptApp.Presentations.Open(filePath, WithWindow: MsoTriState.msoTrue);

            try
            {
                // 设置放映范围
                SlideShowSettings settings = presentation.SlideShowSettings;
                settings.StartingSlide = slideIndexToPlay;
                settings.EndingSlide = slideIndexToPlay;
                settings.AdvanceMode = PpSlideShowAdvanceMode.ppSlideShowManual;

                // 开始放映
                SlideShowWindow slideShow = settings.Run();

                Console.WriteLine("Press any key to stop the slideshow...");
                Console.ReadKey();

                // 停止放映
                slideShow.View.Exit();
            }
            finally
            {
                // 关闭 PowerPoint
                presentation.Close();
                pptApp.Quit();
            }
        }
        public static void SaveAndShowSlideAsImage(string filePath, int slideIndex)
        {
            using (PresentationDocument presentationDocument = PresentationDocument.Open(filePath, false))
            {
                PresentationPart presentationPart = presentationDocument.PresentationPart;
                if (presentationPart != null)
                {
                    slideIndex = 1; // 从 1 开始的索引
                    foreach (var slideId in presentationPart.Presentation.SlideIdList.ChildElements)
                    {
                        var slidePart = presentationPart.GetPartById((slideId as SlideId).RelationshipId) as SlidePart;
                        slideIndex++;
                    }
                }
            }
        }
        
        public static void ShowImageInTerminal(string imagePath)
        {
            // 使用默认图片查看器打开图片
            Process.Start(new ProcessStartInfo(imagePath) { UseShellExecute = true });
        }*/

      /*  public static void PPTShow(string imagePath)
        {
            Microsoft.Office.Interop.PowerPoint.Application pptApplication = new Microsoft.Office.Interop.PowerPoint.Application();
            Microsoft.Office.Interop.PowerPoint.Presentation pptPresentation = null;
            try
            {
                // 打开PowerPoint文件
                pptPresentation = pptApplication.Presentations.Open(@"C:\path\to\your\presentation.pptx",MsoTriState.msoFalse, MsoTriState.msoFalse, MsoTriState.msoTrue);
                // 开始幻灯片放映
                SlideShowSettings settings = pptPresentation.SlideShowSettings;
                settings.StartingSlide = 1;
                settings.EndingSlide = pptPresentation.Slides.Count;

                SlideShowWindow showWindow = settings.Run();

                Console.WriteLine("正在播放幻灯片，按Enter键结束...");
                Console.ReadLine();

                // 结束幻灯片放映
                showWindow.View.Exit();
            }
            catch (Exception ex)
            {
                Console.WriteLine("发生错误: " + ex.Message);
            }
            finally
            {
                // 释放资源
                if (pptPresentation != null)
                {
                    pptPresentation.Close();
                }
                pptApplication.Quit();
            }
        }*/
        static async Task Main()
        {
            List<ChatMessage> Messages_Input = new List<ChatMessage>();

            string filePath = @"D:\src\openai\OpenAI\Prompt1.txt";
            string Promots_Input = string.Empty;

            // Check if the file exists
            if (File.Exists(filePath))
            {
                // Read all text from the file into a single string
                Promots_Input = File.ReadAllText(filePath);
            }


            Messages_Input.Add(new ChatMessage(ChatRole.System, Promots_Input));
            Messages_Input.Add(new ChatMessage(ChatRole.User, "hi"));
            //string response = await gpt_chat(Messages_Input);
            Messages_Input.Add(new ChatMessage(ChatRole.Assistant, await gpt_chat(Messages_Input)));
            
            
            while (true)
            {
                //  Console.WriteLine("you:");
                // string filePath1 = @"D:\src\openai\OpenAI\Presentation1.pptx";
                // SaveAndShowSlideAsImage(filePath1, 0, @"D:\src\openai\OpenAI\out.png");
                /*
                string Input_microphone = await RecognizeSpeechAsync();
                Console.WriteLine(Input_microphone);
                ChatMessage chatmessage = new ChatMessage(ChatRole.User, Input_microphone);
                Messages_Input.Add(chatmessage);
                string response = await gpt_chat(Messages_Input);
                Messages_Input.Add(new ChatMessage(ChatRole.Assistant,response));


                await SynthesisToSpeakerAsync(response);*/
               //aveAndShowSlideAsImage("D:/src/openai/openai/Presentation1.pptx",0, "D:/src/openai/openai/Presentation1_out.jpg");
                
                Console.WriteLine("you:");
                string Input_microphone = Console.ReadLine();
                ChatMessage chatmessage = new ChatMessage(ChatRole.User, Input_microphone);
                Messages_Input.Add(chatmessage);
                string response = await gpt_chat(Messages_Input);

                // If response is empty, retry up to 3 times, and backfill "Great, can you say it again?"
                var emptyResponseCount = 0;
                while (string.IsNullOrEmpty(response) && emptyResponseCount < 3)
                {
                    Console.WriteLine("No response received. Retrying...");
                    response = await gpt_chat(Messages_Input); // Retry if empty
                    emptyResponseCount++;
                }
                if (string.IsNullOrEmpty(response))
                {
                    response = "Great, can you say it again?";
                    Console.WriteLine("Response is still empty after 3 retries. Returning 'Great'.");
                }
                //var word_1 = false;
               // if (response.Contains("Isabel") && !word_1)
              //  {
                 //   SaveAndShowSlideAsImage("D:/src/openai/openai/Presentation1.pptx", 1);
                 //   word_1 = true;
               // }
                // If response has other language, and will reminder hime speak English and answer it again.

                // If it speak scentences larger than 3, stop him and replace with a shorter description

                // If user stay silent longer than 20 secs, please say it again

                // If start to act as user, please stop it and reminder him

                // If talk too many times, please go back to slides content

                Messages_Input.Add(new ChatMessage(ChatRole.Assistant, response));

                //Console.WriteLine(response);
                //await SynthesisToSpeakerAsync(response);

            }
        }
        static async Task Evaluation()
        {
            //how many empty response
            //how many other language
            //how many backfill response 
            //how many long scentences
        }
    }
}




