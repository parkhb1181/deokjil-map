'use client'

/**
 * 올리기 전에 사진을 줄인다.
 *
 * ─────────────────────────────────────────────────────────
 * **휴대폰에서 고른 사진이 그대로는 거의 안 올라간다.**
 *
 * 서버가 받는 것은 jpeg · png · webp 셋이고 5MB 까지인데(AU-08),
 * 요즘 폰 사진은 그 둘을 동시에 어긴다 — 아이폰은 기본이 HEIC 이고,
 * 안드로이드도 한 장이 4~8MB 다. 그래서 사진을 고르면 「JPG · PNG ·
 * WEBP 만 올릴 수 있어요」 나 「5MB 까지」 가 뜨고, 쓰는 사람 눈에는
 * 사진 올리기가 그냥 안 되는 기능으로 보인다.
 *
 * 줄여서 보내면 둘 다 사라진다. **브라우저가 이미 그 사진을 화면에
 * 그릴 줄 안다** — 그리는 김에 캔버스에 옮겨 담으면 형식은 우리가
 * 정하고 크기도 우리가 정한다.
 *
 * 512px 인 이유는 이 사진을 제일 크게 쓰는 자리가 프로필 화면의
 * 56px 짜리 원이라서다. 고밀도 화면을 감안해도 512 면 네 배가 남는다.
 * 더 키워봐야 받는 쪽도 보내는 쪽도 손해다.
 *
 * **못 읽는 사진은 못 읽는다.** 안드로이드 크롬은 HEIC 을 디코딩하지
 * 못하는 경우가 있다. 그때는 예외를 던지고 부르는 쪽이 원래 하던
 * 안내를 띄운다 — 조용히 원본을 올리면 서버가 415 로 막아서 같은
 * 자리에서 더 어려운 말이 나온다.
 */

/** 긴 변 최대 픽셀 */
const MAX_EDGE = 512

/** 캔버스에서 뽑을 형식. 사진이라 jpeg 가 png 보다 훨씬 작다 */
const OUT_TYPE = 'image/jpeg'
const OUT_QUALITY = 0.85

/**
 * 디코딩 자체를 막는 크기.
 *
 * 줄이기 전에도 상한이 필요하다. 100MB 짜리를 캔버스에 올리면 그 폰이
 * 멈춘다. 사진첩에서 고를 수 있는 것 중에 이보다 큰 것은 사진이 아니다.
 */
const DECODE_MAX = 40 * 1024 * 1024

/** 읽기를 포기하는 시각. 폰에서 12MP 한 장이 몇 초 걸린다 */
const DECODE_TIMEOUT = 15_000

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  /* createImageBitmap 이 빠르고 메모리도 덜 쓴다. 사파리 구버전에는
     없어서 img 로 떨어진다 */
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      /* 아래 img 경로로 한 번 더 시도한다. 사파리는 HEIC 을 img 로는
         읽으면서 createImageBitmap 으로는 못 읽는 조합이 있었다 */
    }
  }

  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('decode failed'))
      /*
       * **끝나는 시각을 정해 둔다.** onload 도 onerror 도 안 부르고
       * 가만히 있는 조합이 있다. 그러면 이 약속이 영원히 안 끝나고,
       * 화면은 「사진을 올리는 중이에요」 에 걸린 채 다음 선택도
       * 무시한다 — 쓰는 사람에게는 아무 일도 안 일어나는 것이다.
       */
      setTimeout(() => reject(new Error('decode timeout')), DECODE_TIMEOUT)
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * 사진을 512px jpeg 로 줄인다.
 *
 * 읽지 못하면 던진다. 부르는 쪽이 형식 안내를 띄운다.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (file.size > DECODE_MAX) throw new Error('too large to decode')

  const src = await decode(file)
  const w = 'width' in src ? src.width : 0
  const h = 'height' in src ? src.height : 0
  if (!w || !h) throw new Error('empty image')

  const scale = Math.min(1, MAX_EDGE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.drawImage(src as CanvasImageSource, 0, 0, canvas.width, canvas.height)
  if ('close' in src) src.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, OUT_TYPE, OUT_QUALITY),
  )
  if (!blob) throw new Error('encode failed')

  /* 이름은 확장자만 맞춘다. 서버는 Content-Type 으로 판정하지만
     사람이 보는 자리(에러 문구 등)에 원본 확장자가 남으면 헷갈린다 */
  return new File([blob], 'profile.jpg', { type: OUT_TYPE })
}
