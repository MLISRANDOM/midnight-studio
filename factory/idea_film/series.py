"""Written series defaults used when a premise identifies an existing Midnight Studio show."""
import re


SERIES = {
    "The Safe Room Rules": {
        "aliases": ("safe room rules",),
        "style": "2D horror cartoon, thick black outlines, flat muted colors.",
        "canon": "The bunker beneath Evan's apartment has seven rules. Each night one changes.",
        "cast": {"Evan": "Brown skin, short curly black fade, full connected black beard, charcoal hoodie."},
        "vertical": True,
    },
    "The Reality Helpdesk": {
        "aliases": ("reality helpdesk", "marc jenkins"),
        "style": "2D cartoon, bold outlines, flat colors, green CRT lighting.",
        "canon": "Marc Jenkins fields strange science cases in a 1980s government helpdesk office.",
        "cast": {"Marc": "Expressive Black government helpdesk employee."},
        "vertical": True,
    },
    "Spawned Somewhere Bad": {
        "aliases": ("spawned somewhere bad", "spawnedsomewherebad"),
        "style": "2D cartoon, thick black outlines, large white eyes, flat cel colors.",
        "canon": "The slim human cartoon protagonist keeps his original appearance inside the game world.",
        "cast": {"hero": "Slim brown-skinned man, curly fade, shaped black beard, charcoal hoodie with orange lining and white drawstrings, black pants."},
        "vertical": False,
    },
    "OCCUPANCY": {
        "aliases": ("occupancy episode", "occupancy series", "mara ortiz", "jonah pike", "leah okafor"),
        "style": "2D cartoon, thick black outlines, flat colors, white eyes, blue night lighting.",
        "canon": "At Graywell Apartments, vanished room 604 leaves smooth, uninterrupted plaster.",
        "cast": {
            "Mara": "Medium-brown skin, high braided bun, silver hoops, navy maintenance jacket, gray cargo pants.",
            "Jonah": "Older light-skinned man, full gray beard, brown cap, olive work jacket.",
            "Leah": "Dark skin, low braided ponytail, navy paramedic jacket and medical bag.",
        },
        "vertical": False,
    },
}


def identify(idea):
    for name, series in SERIES.items():
        if any(re.search(r"\b" + re.escape(alias) + r"\b", idea, re.I) for alias in series["aliases"]):
            return name
    if re.search(r"\bOCCUPANCY\b", idea):
        return "OCCUPANCY"
    if re.search(r"\bEvan\b", idea, re.I) and re.search(r"\b(bunker|safe room|rule)\b", idea, re.I):
        return "The Safe Room Rules"
    return None
