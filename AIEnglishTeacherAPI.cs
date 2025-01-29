using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Text.Json;
using Azure.AI.OpenAI;
using System.Speech.Recognition;
using NAudio.Wave;
using OpenAI;

var builder = WebApplication.CreateBuilder(args);

// 添加服务
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 添加CORS支持
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowWeChatMiniProgram",
        builder =>
        {
            builder.WithOrigins("*")
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
});

var app = builder.Build();

// 配置HTTP请求管道
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowWeChatMiniProgram");
app.UseAuthorization();

// 语音识别和AI对话端点
app.MapPost("/api/chat", async (HttpContext context) =>
{
    try
    {
        var form = await context.Request.ReadFormAsync();
        var file = form.Files["audio"];

        if (file == null)
        {
            return Results.BadRequest("No audio file received");
        }

        // 保存音频文件
        var tempPath = Path.GetTempFileName();
        using (var stream = new FileStream(tempPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // 调用Program.cs中的语音识别方法
        string recognizedText = await Program.RecognizeSpeechAsync();

        // 创建聊天消息
        var messages = new List<ChatMessage>();
        // 从配置文件读取系统提示词
        string systemPrompt = File.ReadAllText("Prompt1.txt");
        messages.Add(new ChatMessage(ChatRole.System, systemPrompt));
        messages.Add(new ChatMessage(ChatRole.User, recognizedText));

        // 调用Program.cs中的GPT对话方法
        string aiReply = await Program.gpt_chat(messages);

        // 生成语音回复
        await Program.SynthesisToSpeakerAsync(aiReply);

        // 返回结果
        var response = new
        {
            userText = recognizedText,
            aiReply = aiReply
        };

        // 删除临时文件
        File.Delete(tempPath);

        return Results.Ok(response);
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

// 添加健康检查端点
app.MapGet("/health", () => Results.Ok("Service is healthy"));

app.Run("http://localhost:5000"); 