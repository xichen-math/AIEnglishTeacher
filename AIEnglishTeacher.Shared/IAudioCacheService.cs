namespace AIEnglishTeacher.Shared
{
    public interface IAudioCacheService
    {
        void StoreAudioData(long messageId, string audioData);
        bool TryGetAudioData(long messageId, out string audioData);
        bool TryRemoveAudioData(long messageId, out string audioData);
    }
} 