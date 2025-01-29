using Microsoft.AspNetCore.Mvc;
using Azure.AI.OpenAI;
using OpenAI;
using System.Collections.Concurrent;

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
                    recognizedText = request.Text;
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
                    // 读取系统提示
                    string systemPrompt = System.IO.File.ReadAllText("../openai/openai/Prompt1.txt");
                    newList.Add(new ChatMessage(ChatRole.System, systemPrompt));
                    return newList;
                });

                // 添加用户的新消息
                messages.Add(new ChatMessage(ChatRole.User, recognizedText));

                // 获取AI回复
                    string aiReply = await OpenAI.Program.gpt_chat(messages);

                    // 添加AI的回复到历史记录
                    messages.Add(new ChatMessage(ChatRole.Assistant, aiReply));

                    // 如果对话历史太长，删除较早的消息（保留系统提示）
                    if (messages.Count > 10)
                    {
                        messages.RemoveRange(1, messages.Count - 6);  // 保留系统提示和最后5轮对话
                    }

                // 移除语音合成
                // await OpenAI.Program.SynthesisToSpeakerAsync(aiReply);

                return Ok(new
                {
                    inputType = request.Audio != null ? "audio" : "text",
                    userText = recognizedText,
                    aiReply = aiReply
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
} 