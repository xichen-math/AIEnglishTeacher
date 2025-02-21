import cv2
import pytesseract

# 配置 pytesseract 的路径（如果需要）
# Windows 示例：pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def ocr_with_coordinates(image_path):
    # 读取图像
    image = cv2.imread(image_path)

    # 转换为灰度图像
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 使用 pytesseract 进行 OCR 识别，获取文字和坐标信息
    data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT)

    # 提取文字和坐标
    n_boxes = len(data['text'])
    for i in range(n_boxes):
        if data['text'][i].strip():  # 过滤掉空字符串
            word = data['text'][i]
            x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
            print(f"单词: {word}, 坐标: (x: {x}, y: {y}, w: {w}, h: {h})")

# 调用函数
image_path = "example_image.png"  # 替换为你的图片路径
ocr_with_coordinates(image_path)