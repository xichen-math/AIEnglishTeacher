using Microsoft.AspNetCore.Mvc;
using Azure.AI.OpenAI;
using OpenAI;
using System.Collections.Concurrent;
using System.Text.Json;

namespace AIEnglishTeacher.API.Controllers
{
    public class ChatRequest
    {
        public IFormFile? Audio { get; set; }
        public string? Text { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        // 使用ConcurrentDictionary来存储每个用户的对话历史
        private static readonly ConcurrentDictionary<string, List<ChatMessage>> _userChats = new();
        private const int MAX_MESSAGES = 20; // 限制保留的消息数量
        private const int MAX_MESSAGE_LENGTH = 1000; // 限制每条消息的长度

        public ChatController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpPost]
        public async Task<IActionResult> Chat([FromForm] ChatRequest request, [FromHeader(Name = "X-User-Id")] string userId)
        {
            try
            {
                string recognizedText;

                // 检查是否是文本消息
                if (!string.IsNullOrEmpty(request.Text))
                {
                    // 限制输入文本长度
                    recognizedText = request.Text.Length > MAX_MESSAGE_LENGTH 
                        ? request.Text.Substring(0, MAX_MESSAGE_LENGTH) 
                        : request.Text;
                }
                // 检查是否有音频文件
                else if (request.Audio != null)
                {
                    // 处理语音输入
                    var tempPath = Path.GetTempFileName();
                    using (var stream = new FileStream(tempPath, FileMode.Create))
                    {
                        await request.Audio.CopyToAsync(stream);
                    }

                    // 语音识别
                    recognizedText = await OpenAI.Program.RecognizeSpeechAsync();
                    
                    // 删除临时文件
                    System.IO.File.Delete(tempPath);

                    // 限制识别文本长度
                    if (recognizedText.Length > MAX_MESSAGE_LENGTH)
                    {
                        recognizedText = recognizedText.Substring(0, MAX_MESSAGE_LENGTH);
                    }
                }
                else
                {
                    return BadRequest("Either audio file or text input is required");
                }

                if (string.IsNullOrEmpty(userId))
                {
                    return BadRequest("User ID is required");
                }

                // 获取或创建用户的对话历史
                var messages = _userChats.GetOrAdd(userId, _ => {
                    var newList = new List<ChatMessage>();
                    try
                    {
                        // 读取系统提示
                        string systemPrompt = System.IO.File.ReadAllText("../openai/openai/Prompt1.txt");
                        newList.Add(new ChatMessage(ChatRole.System, systemPrompt));
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error reading system prompt: {ex.Message}");
                        // 使用默认系统提示
                        newList.Add(new ChatMessage(ChatRole.System, "You are an AI English teacher. Keep responses concise and focused on teaching English."));
                    }
                    return newList;
                });

                try
                {
                    // 添加用户的新消息
                    messages.Add(new ChatMessage(ChatRole.User, recognizedText));

                    // 保持对话历史在限制范围内
                    if (messages.Count > MAX_MESSAGES + 1) // +1 是因为要保留系统提示
                    {
                        // 保留系统提示和最新的消息
                        var systemMessage = messages[0];
                        var recentMessages = messages.Skip(messages.Count - MAX_MESSAGES).Take(MAX_MESSAGES).ToList();
                        messages.Clear();
                        messages.Add(systemMessage);
                        messages.AddRange(recentMessages);
                    }

                    // 获取AI回复
                    string aiReply = await OpenAI.Program.gpt_chat(messages);

                    // 尝试解析AI回复
                    try 
                    {
                        var aiResponse = JsonSerializer.Deserialize<JsonDocument>(aiReply);
                        
                        // 检查是否有错误
                        if (aiResponse.RootElement.TryGetProperty("error", out var errorElement) && 
                            errorElement.GetBoolean())
                        {
                            string errorMessage = aiResponse.RootElement.GetProperty("message").GetString();
                            return StatusCode(500, new { error = true, message = errorMessage });
                        }

                        // 获取AI回复内容
                        string aiReplyContent = aiResponse.RootElement.GetProperty("aiReply").GetString();
                        string audioDataContent = aiResponse.RootElement.GetProperty("audioData").GetString();

                        // 限制AI回复长度
                        if (aiReplyContent.Length > MAX_MESSAGE_LENGTH)
                        {
                            aiReplyContent = aiReplyContent.Substring(0, MAX_MESSAGE_LENGTH);
                        }

                        // 添加AI的回复到历史记录
                        messages.Add(new ChatMessage(ChatRole.Assistant, aiReplyContent));

                        return Ok(new
                        {
                            inputType = request.Audio != null ? "audio" : "text",
                            userText = recognizedText,
                            aiReply = aiReplyContent,
                            audioData = audioDataContent
                        });
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error parsing AI response: {ex.Message}");
                        return StatusCode(500, new { error = true, message = "Error processing AI response" });
                    }
                }
                catch (Exception ex) when (ex.Message.Contains("context length"))
                {
                    // 处理上下文长度超限错误
                    // 清空历史记录，只保留系统提示和当前消息
                    var systemMessage = messages[0];
                    messages.Clear();
                    messages.Add(systemMessage);
                    messages.Add(new ChatMessage(ChatRole.User, recognizedText));
                    
                    // 重试一次
                    string aiReply = await OpenAI.Program.gpt_chat(messages);
                    
                    // 解析重试后的响应
                    try 
                    {
                        var retryResponse = JsonSerializer.Deserialize<JsonDocument>(aiReply);
                        string retryReplyContent = retryResponse.RootElement.GetProperty("aiReply").GetString();
                        string retryAudioContent = retryResponse.RootElement.GetProperty("audioData").GetString();
                        
                        // 添加AI的回复到历史记录
                        messages.Add(new ChatMessage(ChatRole.Assistant, retryReplyContent));

                        return Ok(new
                        {
                            inputType = request.Audio != null ? "audio" : "text",
                            userText = recognizedText,
                            aiReply = retryReplyContent,
                            audioData = retryAudioContent,
                            warning = "Conversation history was cleared due to length limits"
                        });
                    }
                    catch (Exception parseEx)
                    {
                        Console.WriteLine($"Error parsing retry response: {parseEx.Message}");
                        return StatusCode(500, new { error = true, message = "Error processing retry response" });
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in Chat endpoint: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                return StatusCode(500, new { error = "Internal server error", message = ex.Message });
            }
        }
    }
} 