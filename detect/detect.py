"""
detect.py  –  YOLOv8 inference with best4.pt
Usage:
    python detect.py --input <path> --output <path> [--conf 0.25]

Supports: jpg, jpeg, png, bmp, gif, webp (image)  |  mp4, avi, mov, mkv, webm (video)
Prints a JSON result to stdout.
"""
import argparse
import json
import os
import sys
import time

# ── suppress ultralytics / torch noise ────────────────────────────────────────
os.environ["YOLO_VERBOSE"] = "False"

try:
    from ultralytics import YOLO
    import cv2
except ImportError as e:
    print(json.dumps({"error": f"Missing dependency: {e}"}))
    sys.exit(1)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "best4.pt")

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"}
VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


def load_model():
    if not os.path.exists(MODEL_PATH):
        print(json.dumps({"error": f"Model not found: {MODEL_PATH}"}))
        sys.exit(1)
    return YOLO(MODEL_PATH)


# ── image inference ────────────────────────────────────────────────────────────
def detect_image(model, input_path: str, output_path: str, conf: float):
    results = model.predict(source=input_path, conf=conf, verbose=False)
    result = results[0]

    # annotated frame
    annotated = result.plot()
    cv2.imwrite(output_path, annotated)

    detections = []
    boxes = result.boxes
    if boxes is not None:
        for box in boxes:
            cls_id = int(box.cls[0])
            label = model.names.get(cls_id, str(cls_id))
            confidence = float(box.conf[0])
            xyxy = box.xyxy[0].tolist()
            detections.append({
                "label": label,
                "confidence": round(confidence, 4),
                "x": round(xyxy[0]),
                "y": round(xyxy[1]),
                "width": round(xyxy[2] - xyxy[0]),
                "height": round(xyxy[3] - xyxy[1]),
            })

    return {
        "type": "image",
        "detections": detections,
        "output_path": output_path,
        "total_detections": len(detections),
    }


# ── video inference (PyAV → H.264 MP4, browser-compatible) ────────────────────
def detect_video(model, input_path: str, output_path: str, conf: float):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        return {"error": f"Cannot open video: {input_path}"}

    fps   = cap.get(cv2.CAP_PROP_FPS) or 25.0
    w     = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h     = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Always write .mp4 with H.264 via PyAV (browser-compatible)
    output_path = os.path.splitext(output_path)[0] + ".mp4"

    try:
        import av as _av
        _use_pyav = True
    except ImportError:
        _use_pyav = False

    if _use_pyav:
        # ── PyAV H.264 writer ─────────────────────────────────────────────────
        container = _av.open(output_path, mode="w")
        stream    = container.add_stream("libx264", rate=int(fps))
        stream.width  = w
        stream.height = h
        stream.pix_fmt = "yuv420p"
        # fast-start: moov atom at front so browser can stream without full download
        stream.options = {"movflags": "faststart", "preset": "ultrafast", "crf": "28"}

        def _write_pyav(bgr_frame):
            rgb = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
            vf  = _av.VideoFrame.from_ndarray(rgb, format="rgb24")
            vf  = vf.reformat(format="yuv420p")
            for pkt in stream.encode(vf):
                container.mux(pkt)

        def _flush_pyav():
            for pkt in stream.encode():
                container.mux(pkt)
            container.close()

    else:
        # ── Fallback: OpenCV MJPEG AVI (older browsers may not play) ─────────
        output_path = os.path.splitext(output_path)[0] + ".avi"
        fourcc = cv2.VideoWriter_fourcc(*"MJPG")
        writer = cv2.VideoWriter(output_path, fourcc, fps, (w, h))
        _write_pyav  = writer.write    # type: ignore[assignment]
        _flush_pyav  = writer.release  # type: ignore[assignment]

    all_detections: dict = {}
    frame_results  = []
    frame_idx      = 0
    SAMPLE_EVERY   = max(1, int(fps // 5))   # ~5 inferences/sec
    last_annotated = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % SAMPLE_EVERY == 0:
            results = model.predict(source=frame, conf=conf, verbose=False)
            result  = results[0]
            last_annotated = result.plot()

            boxes = result.boxes
            frame_dets = []
            if boxes is not None:
                for box in boxes:
                    cls_id     = int(box.cls[0])
                    label      = model.names.get(cls_id, str(cls_id))
                    confidence = float(box.conf[0])
                    xyxy       = box.xyxy[0].tolist()
                    det = {
                        "label":      label,
                        "confidence": round(confidence, 4),
                        "x":          round(xyxy[0]),
                        "y":          round(xyxy[1]),
                        "width":      round(xyxy[2] - xyxy[0]),
                        "height":     round(xyxy[3] - xyxy[1]),
                        "frame":      frame_idx,
                    }
                    frame_dets.append(det)
                    if label not in all_detections or all_detections[label]["confidence"] < confidence:
                        all_detections[label] = {k: v for k, v in det.items() if k != "frame"}

            if frame_dets:
                frame_results.append({"frame": frame_idx, "detections": frame_dets})

        # Write annotated frame if available, else original
        _write_pyav(last_annotated if last_annotated is not None else frame)
        frame_idx += 1

    cap.release()
    _flush_pyav()

    return {
        "type":             "video",
        "detections":       list(all_detections.values()),
        "frame_results":    frame_results[:20],
        "total_frames":     frame_idx,
        "output_path":      output_path,
        "total_detections": len(all_detections),
    }


# ── main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="YOLOv8 detect with best4.pt")
    parser.add_argument("--input",  required=True, help="Path to input file")
    parser.add_argument("--output", required=True, help="Path to output file")
    parser.add_argument("--conf",   type=float, default=0.25, help="Confidence threshold")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(json.dumps({"error": f"Input file not found: {args.input}"}))
        sys.exit(1)

    ext = os.path.splitext(args.input)[1].lower()
    model = load_model()

    t0 = time.time()
    if ext in IMAGE_EXTS:
        result = detect_image(model, args.input, args.output, args.conf)
    elif ext in VIDEO_EXTS:
        result = detect_video(model, args.input, args.output, args.conf)
    else:
        print(json.dumps({"error": f"Unsupported file extension: {ext}"}))
        sys.exit(1)

    result["elapsed_seconds"] = round(time.time() - t0, 2)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
