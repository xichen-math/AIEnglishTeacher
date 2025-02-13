using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenAI;
using AIEnglishTeacher.Shared;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 注册音频缓存服务
builder.Services.AddSingleton<IAudioCacheService, AudioCacheService>();

// 配置 Kestrel
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(2);
    options.Limits.RequestHeadersTimeout = TimeSpan.FromMinutes(2);
});

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowWeChatMiniProgram",
        builder =>
        {
            builder.SetIsOriginAllowed(_ => true)  // 允许所有来源
                   .AllowAnyMethod()
                   .AllowAnyHeader()
                   .AllowCredentials();
        });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// 移除 HTTPS 重定向
// app.UseHttpsRedirection();

app.UseCors("AllowWeChatMiniProgram");

app.UseAuthorization();

app.MapControllers();

// 添加健康检查端点
app.MapGet("/health", () => Results.Ok("Service is healthy"));

// 指定监听地址，使用 0.0.0.0 允许所有网络接口访问
app.Urls.Clear();
app.Urls.Add("http://0.0.0.0:5000");

app.Run(); 
