import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

function randomIndex(exclude, length) {
  if (length <= 1) return 0;
  let n = exclude;
  let guard = 0;
  while (n === exclude && guard < 20) {
    n = Math.floor(Math.random() * length);
    guard += 1;
  }
  return n === exclude ? (exclude + 1) % length : n;
}

export function usePlayer({ cacheTrack }) {
  const audioRef = useRef(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);

  const applyTrack = useCallback(
    (track, tracks, index) => {
      const hasAudio = Boolean(track?.audio_url || track?.file_id);
      setCurrentTrack(track);
      setQueue(tracks);
      setQueueIndex(index);
      setIsPlaying(true);
      if (cacheTrack && hasAudio) cacheTrack(track);
      if (!hasAudio) {
        toast.info(`No audio source for "${track?.title}".`);
      }
      setTimeout(() => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((e) => console.log(e));
      }, 100);
    },
    [cacheTrack]
  );

  const playTrack = useCallback(
    (track, tracks = []) => {
      const index = tracks.findIndex((t) => t.id === track.id);
      applyTrack(track, tracks, index >= 0 ? index : 0);
    },
    [applyTrack]
  );

  const playIndex = useCallback(
    (i, tracks = queue) => {
      if (!tracks.length) return;
      const clamped = Math.max(0, Math.min(i, tracks.length - 1));
      applyTrack(tracks[clamped], tracks, clamped);
    },
    [applyTrack, queue]
  );

  const playRandom = useCallback(
    (tracks) => {
      if (!tracks || tracks.length === 0) {
        toast.info("This playlist has no tracks.");
        return;
      }
      setShuffle(true);
      playIndex(Math.floor(Math.random() * tracks.length), tracks);
    },
    [playIndex]
  );

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.log(err));
    }
  }, [isPlaying]);

  const skip = useCallback(
    (direction) => {
      if (!queue.length) return;
      if (direction > 0) {
        if (shuffle) {
          playIndex(randomIndex(queueIndex, queue.length));
        } else if (queueIndex + 1 < queue.length) {
          playIndex(queueIndex + 1);
        }
      } else if (queueIndex - 1 >= 0) {
        playIndex(queueIndex - 1);
      }
    },
    [queue, queueIndex, shuffle, playIndex]
  );

  const onEnded = useCallback(() => {
    if (!queue.length) return;
    if (shuffle) {
      playIndex(randomIndex(queueIndex, queue.length));
    } else if (queueIndex + 1 < queue.length) {
      playIndex(queueIndex + 1);
    } else {
      setIsPlaying(false);
    }
  }, [queue, queueIndex, shuffle, playIndex]);

  const onTimeUpdate = useCallback(
    () => setCurrentTime(audioRef.current?.currentTime || 0),
    []
  );

  const onLoadedMetadata = useCallback(
    () => setDuration(audioRef.current?.duration || 0),
    []
  );

  const setVolumeLevel = useCallback((v) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  return {
    audioRef,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    playTrack,
    playRandom,
    playIndex,
    togglePlay,
    toggleShuffle,
    skip,
    onEnded,
    onTimeUpdate,
    onLoadedMetadata,
    setVolumeLevel,
  };
}