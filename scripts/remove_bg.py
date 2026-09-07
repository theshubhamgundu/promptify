import sys
from PIL import Image

def remove_black_background(input_path, output_path, threshold=22, softness=28):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    for item in datas:
        r, g, b, a = item
        # Luminance / brightness
        brightness = max(r, g, b)
        
        if brightness < threshold:
            # Completely transparent
            new_data.append((r, g, b, 0))
        elif brightness < threshold + softness:
            # Soft smooth alpha ramp for anti-aliased edge
            alpha_factor = (brightness - threshold) / softness
            new_alpha = int(255 * (alpha_factor ** 1.2))
            new_data.append((r, g, b, new_alpha))
        else:
            new_data.append((r, g, b, 255))
            
    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"Successfully saved transparent image to {output_path}")

if __name__ == "__main__":
    input_file = r"c:\Users\Asus\Downloads\promptify\public\assets\prompt-workspace.jpg"
    output_file = r"c:\Users\Asus\Downloads\promptify\public\assets\prompt-workspace-transparent.png"
    remove_black_background(input_file, output_file)
