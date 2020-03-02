import os
import math
import json
from functools import reduce

path = "./data_cleaned"

threshold = 4

points = []

for filename in os.listdir(path):
    f = open(os.path.join(path, filename), 'r')
    content = f.read()

    def formatString(str):
        strArray = str.split(".")
        numComponents = len(strArray)

        if numComponents == 4:
            x_1, y_1, x_2, y_2 = list(map(int, strArray))

            return {
                'x': x_1,
                'y': y_1,
                'type': 'move_to'
            }, {
                'x': x_2,
                'y': y_2,
                'type': 'line_to'
            }
        else:
            return None

    def formatPoints(content):
        for idx, line in enumerate(content):
            formattedString = formatString(line)

            if formattedString != None:
                yield formatString(line)

            formattedStringPrev = content[idx - 1].split(".")

            if len(formattedStringPrev) == 4:
                _, _, x, y = list(map(int, formattedStringPrev))

                yield {
                    'x': x,
                    'y': y,
                    'type': 'close_path'
                }, None

    formattedPoints = list(
        filter(None, list(sum(formatPoints(content.split("_")[1:]), ()))))

    def reducePoints(points):
        thresholdedPoints = []

        for idx, point in enumerate(points[1:]):
            prevPoint = points[idx - 1]
            distance = math.sqrt((point['x'] - prevPoint['x']) ** 2 +
                                 (point['y'] - prevPoint['y']) ** 2)

            if distance > threshold:
                thresholdedPoints.append(point)

        return thresholdedPoints

    points.extend(reducePoints(formattedPoints))

with open('cleaned_sheep.json', 'w') as outfile:
    json.dump(points, outfile)
