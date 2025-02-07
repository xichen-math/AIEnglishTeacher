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

// 使用控制器路由
app.MapControllers();

// 添加健康检查端点
app.MapGet("/health", () => Results.Ok("Service is healthy"));

app.Run("http://localhost:5000"); 