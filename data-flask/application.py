#!/usr/bin/env python
from flask import Flask, jsonify, request
from flask.ext.cors import CORS, cross_origin
import json

application = Flask(__name__, static_url_path='/static')
cors = CORS(application)
application.config['CORS_HEADERS'] = 'Content-Type'

counts = []

@application.route('/shannon', methods=['GET'])
@cross_origin()
def shannon():
    q = int(request.args.get('q'))
    print(q)
    counts[q] += 1
    qjson = json.dumps(counts)
    qfile = open("q.json", "w")
    qfile.write(qjson)
    qfile.close()
    return qjson


if __name__ == "__main__":
    qfile = open("q.json")
    qjson = qfile.read()
    qfile.close()
    counts = json.loads(qjson)
    application.run(debug=True, port=5001) # for prod
