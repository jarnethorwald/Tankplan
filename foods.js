/* Gebräuchliche Lebensmittel in Deutschland, Näherungswerte je 100 g bzw. 100 ml.
   Spalten: Name | kcal | Kohlenhydrate | Eiweiß | Fett | Ballaststoffe | Gruppe | Farbe | Vitamine | Portion | Gramm je Portion
   Gruppe: G = Gemüse, O = Obst. Farbe: r rot, o orange, y gelb, g grün, b blau/violett, w weiß.
   Vitamine (reiche Quelle): C, A (Carotin), K, F (Folat), E. */
window.FOODS_RAW = `
Vollkornbrot|215|40|7|1.5|7||||Scheibe|50
Roggenmischbrot|215|43|6|1|4.5||||Scheibe|50
Weizenmischbrot|240|47|7.5|1.2|3.5||||Scheibe|50
Weißbrot|265|50|8|2|3||||Scheibe|40
Toastbrot|265|48|8|3.5|3||||Scheibe|25
Brötchen (Semmel)|270|53|9|1.5|3||||Stück|55
Vollkornbrötchen|240|44|9|2|6||||Stück|60
Körnerbrötchen|280|42|11|7|6||||Stück|65
Laugenbrezel|290|55|9|3.5|3||||Stück|80
Baguette|270|55|9|1|3||||Scheibe|30
Knäckebrot|340|65|10|1.5|13||||Scheibe|10
Haferflocken|370|59|13.5|7|10||||Portion|50
Müsli mit Früchten|350|65|9|6|8||||Portion|60
Cornflakes|375|84|7|1|3||||Portion|40
Granola|430|60|9|17|7||||Portion|50
Reiswaffel|385|80|8|3|3||||Stück|8
Nudeln (roh)|355|71|12.5|1.5|3||||Portion|100
Nudeln (gekocht)|155|30|5.5|0.9|2||||Portion|250
Vollkornnudeln (gekocht)|150|27|6|1.2|4.5||||Portion|250
Reis (roh)|350|77|7|0.6|1.4||||Portion|80
Reis (gekocht)|130|28|2.7|0.3|0.4||||Portion|200
Vollkornreis (gekocht)|125|26|2.7|1|1.8||||Portion|200
Couscous (gekocht)|112|23|3.8|0.2|1.4||||Portion|200
Bulgur (gekocht)|83|19|3|0.2|4.5||||Portion|200
Quinoa (gekocht)|120|21|4.4|1.9|2.8||||Portion|180
Hirse (gekocht)|119|24|3.5|1|1.3||||Portion|180
Polenta (gekocht)|70|15|1.5|0.3|1.2||||Portion|200
Milchreis|120|22|3|2.5|0.2||||Portion|250
Porridge mit Milch|95|14|4|2.5|1.7||||Portion|300
Pfannkuchen|210|26|7|8|1||||Stück|80
Kartoffeln (gekocht)|72|15.5|2|0.1|1.7||||Portion|250
Süßkartoffel (gekocht)|90|21|1.6|0.1|3||o|A|Portion|200
Kartoffelpüree|90|14|2|3|1.5||||Portion|250
Bratkartoffeln|140|18|2.5|6|2||||Portion|250
Pommes frites|270|35|3.5|13|3.5||||Portion|150
Kartoffelknödel|120|25|3|0.5|1.5||||Stück|120
Semmelknödel|180|26|6|5|1.5||||Stück|100
Spätzle (gekocht)|170|28|7|3|1.5||||Portion|200
Gnocchi|165|35|4|0.7|2||||Portion|200
Maultaschen|200|25|8|7|2||||Stück|60
Kartoffelsalat|130|14|2|7|1.5||||Portion|200
Pizza Margherita|250|32|10|9|2||||Pizza|350
Lasagne|140|13|7|7|1||||Portion|350
Döner Kebab|215|20|11|10|2||||Döner|350
Hamburger|250|28|13|10|1.5||||Burger|200
Currywurst mit Soße|200|10|10|13|1||||Portion|250
Schnitzel paniert|250|13|17|14|1||||Stück|180
Fischstäbchen|180|18|12|7|1||||Stück|30
Sushi Maki|150|28|5|1|0.8||||Portion|180
Milch 1,5 %|47|4.8|3.4|1.5|0||||Glas|200
Milch 3,5 %|65|4.8|3.3|3.5|0||||Glas|200
Hafermilch|45|6.5|0.5|1.5|0.8||||Glas|200
Sojamilch ungesüßt|40|2.5|3.3|2|0.5||||Glas|200
Joghurt 1,5 %|50|4.7|4.1|1.5|0||||Becher|150
Joghurt 3,5 %|65|4.7|3.5|3.5|0||||Becher|150
Griechischer Joghurt|130|4|5.5|10|0||||Portion|150
Skyr|63|4|11|0.2|0||||Becher|150
Magerquark|67|3.5|12|0.3|0||||Portion|250
Quark 20 %|105|3.5|11.5|5|0||||Portion|250
Hüttenkäse|98|2.5|12|4.5|0||||Becher|200
Frischkäse|260|3.5|6|25|0||||Portion|30
Gouda|356|0|25|28|0||||Scheibe|30
Emmentaler|380|0|28|30|0||||Scheibe|30
Mozzarella|250|1|19|19|0||||Packung|125
Feta|260|1|17|21|0||||Portion|50
Parmesan|400|0|36|28|0||||EL|10
Camembert|290|0.5|19|23|0||||Ecke|50
Butter|740|0.6|0.7|82|0||||Portion|10
Sahne|290|3.5|2.4|30|0||||EL|15
Crème fraîche|300|3|2.5|30|0||||EL|20
Ei|140|1|12.5|9.5|0||||Stück|55
Rührei|165|1.5|11|13|0||||Portion|150
Hähnchenbrust (gebraten)|165|0|31|3.6|0||||Portion|150
Hähnchenbrust (roh)|110|0|22.5|1.5|0||||Portion|150
Hähnchenschenkel (gebraten)|200|0|26|10|0||||Stück|150
Putenbrust (gebraten)|140|0|30|2|0||||Portion|150
Putenbrust Aufschnitt|105|1|20|2|0||||Scheibe|15
Rinderhack mager (roh)|180|0|20|11|0||||Portion|150
Hackfleisch gemischt (roh)|260|0|17|21|0||||Portion|150
Rindersteak (gebraten)|190|0|30|7|0||||Portion|180
Schweinefilet (roh)|110|0|22|2.5|0||||Portion|150
Kochschinken|110|1|19|3.5|0||||Scheibe|20
Salami|430|1|22|38|0||||Scheibe|10
Leberwurst|320|1.5|13|30|0||||Portion|20
Bratwurst|300|2|13|27|0||||Stück|120
Wiener Würstchen|270|1|12|24|0||||Stück|50
Leberkäse|290|1.5|12|25|0||||Scheibe|100
Lachs (roh)|200|0|20|13|0||||Filet|150
Räucherlachs|180|0|22|10|0||||Scheibe|25
Thunfisch im eigenen Saft|110|0|25|1|0||||Dose (abgetropft)|120
Forelle|120|0|20|4|0||||Filet|150
Kabeljau|82|0|17.5|0.7|0||||Filet|150
Garnelen|85|0.5|18|1|0||||Portion|120
Hering|195|0|18|13.5|0||||Filet|100
Tomate|18|2.6|0.9|0.2|1.2|G|r|C|Stück|80
Gurke|12|1.8|0.6|0.2|0.5|G|g|K|Portion|100
Paprika rot|37|6|1|0.4|2|G|r|CA|Stück|150
Paprika gelb|28|5|1|0.2|1.8|G|y|C|Stück|150
Paprika grün|20|2.9|0.9|0.2|1.8|G|g|C|Stück|150
Karotte|35|7|0.9|0.2|3|G|o|A|Stück|80
Zucchini|19|2|2|0.4|1.1|G|g|C|Portion|150
Brokkoli|34|2.7|3.7|0.2|3|G|g|CKF|Portion|150
Blumenkohl|25|2.3|2.5|0.3|2.9|G|w|CF|Portion|150
Spinat|23|0.6|2.7|0.4|2.1|G|g|AKF|Portion|150
Feldsalat|20|0.7|2|0.4|1.8|G|g|ACK|Portion|50
Eisbergsalat|14|2|1.2|0.2|1.3|G|g|K|Portion|80
Kopfsalat|14|1.5|1.3|0.2|1.5|G|g|KF|Portion|80
Rucola|27|2|2.6|0.7|1.5|G|g|AKF|Portion|30
Zwiebel|28|5|1.2|0.2|1.8|G|w||Stück|60
Champignons|16|0.4|2.5|0.3|1.5|G|w||Portion|125
Aubergine|24|2.5|1|0.2|3|G|b||Portion|150
Rote Bete|42|8|1.5|0.1|2.5|G|b|F|Portion|100
Kohlrabi|24|3.7|1.7|0.1|1.4|G|g|C|Stück|200
Rotkohl|27|4|1.5|0.2|2.5|G|b|CK|Portion|150
Weißkohl|25|4|1.3|0.2|2.5|G|w|CK|Portion|150
Sauerkraut|18|1|1.2|0.2|2.2|G|w|C|Portion|150
Fenchel|28|4|2|0.4|3|G|w|CF|Portion|150
Spargel|20|2|2|0.2|1.5|G|g|KF|Portion|250
Erbsen (TK)|70|10|6|0.5|5|G|g|CKF|Portion|100
Mais (Dose)|90|16|3|1.5|3|G|y||Portion|100
Kürbis|26|4.5|1|0.1|2|G|o|A|Portion|200
Lauch|30|3|2.1|0.3|2.3|G|g|KF|Portion|100
Grüne Bohnen|31|4.7|2.4|0.2|3|G|g|CKF|Portion|150
Radieschen|15|2|1|0.1|1.5|G|r|C|Portion|50
Passierte Tomaten|30|4.5|1.5|0.3|1.5|G|r|C|Portion|200
Tomatensoße (Glas)|55|8|1.5|1.8|1.5|G|r|C|Portion|150
Avocado|160|1.8|2|15|6.7|O|g|KFE|Stück|150
Apfel|52|11.4|0.3|0.4|2.1|O|r||Stück|180
Banane|88|20|1.2|0.2|1.8|O|y||Stück|120
Orange|47|8.5|1|0.2|2|O|o|CF|Stück|180
Mandarine|46|9|0.8|0.3|1.7|O|o|C|Stück|80
Birne|55|12|0.4|0.3|3|O|y||Stück|170
Weintrauben|70|15.5|0.7|0.2|1.5|O|b||Portion|150
Erdbeeren|32|5.5|0.7|0.4|2|O|r|CF|Portion|150
Himbeeren|36|4.8|1.3|0.3|4.7|O|r|C|Portion|125
Blaubeeren|42|7.4|0.7|0.5|3.1|O|b|CK|Portion|125
Kiwi|52|10|1|0.6|2.1|O|g|CK|Stück|80
Ananas|55|12|0.5|0.2|1.4|O|y|C|Portion|150
Mango|62|13.5|0.6|0.4|1.8|O|o|CA|Portion|150
Wassermelone|36|8|0.6|0.2|0.4|O|r|C|Portion|250
Honigmelone|54|11|0.5|0.1|0.9|O|o|CA|Portion|200
Pfirsich|40|8.5|0.9|0.1|1.5|O|o|CA|Stück|150
Kirschen|63|13|1|0.3|1.3|O|r|C|Portion|150
Pflaumen|47|10|0.6|0.2|1.6|O|b||Stück|40
Aprikose|43|8.5|0.9|0.1|1.6|O|o|A|Stück|45
Datteln|290|65|2|0.4|8||||Stück|8
Rosinen|300|66|3|0.5|5||||Portion|30
Getrocknete Aprikosen|240|50|3|0.5|8|||A|Portion|30
Apfelmus|60|14|0.3|0.2|1.5||||Portion|100
Orangensaft|45|9|0.7|0.2|0.2|||C|Glas|200
Linsen (gekocht)|115|17|9|0.5|8|||F|Portion|200
Kichererbsen (gekocht)|135|20|8|2.5|6|||F|Portion|150
Kidneybohnen (Dose)|100|14|7|0.5|6|||F|Portion|150
Weiße Bohnen (Dose)|95|13|7|0.5|6|||F|Portion|150
Tofu natur|120|1|13|7|1||||Portion|125
Hummus|230|9|7|17|5||||Portion|50
Erdnussbutter|600|12|25|50|6|||E|EL|15
Mandeln|580|5|21|51|11|||E|Handvoll|25
Walnüsse|690|4|15|65|7|||E|Handvoll|25
Haselnüsse|630|7|14|61|10|||E|Handvoll|25
Cashewkerne|570|27|18|44|3|||E|Handvoll|25
Erdnüsse|600|8|25|50|8|||E|Handvoll|25
Sonnenblumenkerne|580|13|21|49|7|||E|EL|10
Kürbiskerne|560|5|30|46|6|||E|EL|10
Leinsamen|530|2|24|42|27|||E|EL|10
Chiasamen|490|8|17|31|34|||E|EL|10
Studentenfutter|480|35|14|33|6|||E|Handvoll|30
Olivenöl|900|0|0|100|0|||E|EL|10
Rapsöl|900|0|0|100|0|||E|EL|10
Zartbitterschokolade|540|35|7|36|10||||Rippe|10
Milchschokolade|540|57|7|31|2||||Rippe|10
Nutella|540|57|6|31|3||||EL|20
Honig|305|75|0.4|0|0||||TL|10
Marmelade|250|60|0.4|0.1|1||||TL|15
Zucker|400|100|0|0|0||||TL|5
Gummibärchen|340|77|7|0.5|0||||Handvoll|30
Müsliriegel|400|65|6|14|5||||Riegel|25
Sport-Energieriegel|380|62|8|10|4||||Riegel|50
Proteinriegel|350|30|30|11|5||||Riegel|45
Rührkuchen|400|50|5|20|1||||Stück|80
Croissant|400|45|8|21|2||||Stück|60
Butterkeks|450|73|7|14|2||||Stück|7
Lebkuchen|390|65|5|12|3||||Stück|40
Eiscreme|200|24|3.5|10|0.5||||Kugel|60
Salzstangen|370|73|10|3|3||||Stück|3
Kartoffelchips|540|50|6|35|4||||Portion|30
Energie-Gel|245|61|0|0|0||||Gel|40
Sportgetränk isotonisch|26|6.2|0|0|0||||Flasche|500
Maltodextrin|380|95|0|0|0||||Portion|30
Carbo-Pulver (Dextrose)|380|95|0|0|0||||Portion|30
Whey Proteinpulver|380|6|78|6|0||||Portion|30
Cola|42|10.6|0|0|0||||Glas|250
Apfelschorle|24|5.5|0|0|0||||Glas|250
Limonade|40|10|0|0|0||||Glas|250
Bier|43|3.5|0.4|0|0||||Glas|500
Bier alkoholfrei|25|5|0.4|0|0||||Glas|500
Rotwein|85|0.3|0.1|0|0||||Glas|150
Cappuccino|35|3|2|1.5|0||||Tasse|180
Latte Macchiato|50|4.5|3|2|0||||Glas|250
Kakao (mit Milch)|75|10|3.5|2.5|0.5||||Tasse|250
Kokoswasser|20|4|0.2|0|0||||Packung|330
Pesto|450|3|5|45|2||||EL|15
Ketchup|110|25|1.5|0.2|1||||EL|15
Mayonnaise|700|3|1.5|77|0||||EL|15
Senf|90|6|6|5|3||||TL|10
Sojasoße|60|5|8|0|0||||EL|15
`.trim();

/* ---------- Imbiss und Fast Food: Gerichte aus Bausteinen ----------
   Bausteine je 100 g: [kcal, Kohlenhydrate, Eiweiß, Fett, Ballaststoffe].
   Quellen und Stand siehe Übergabe-Dokument. Alle Werte sind Richtwerte, weil Imbisse und Pizzerien unterschiedlich arbeiten.
   Gewichte je Größe sind Durchschnittswerte aus typischen Portionen, keine Messung. */
(function () {
  var C = {
    brot: [270, 52, 9, 2, 3],           // Döner-Fladenbrot (Weißmehl)
    yufka: [305, 50, 8.5, 7, 3],        // Dürüm-Yufka/Wrap
    kalb: [238, 3.3, 24.7, 14, 0],      // Dönerfleisch Kalb/Rind (fddb Durchschnitt)
    huhn: [183, 1.5, 23, 9.5, 0],       // Dönerfleisch Hähnchen
    falafel: [333, 31.8, 13.3, 17.8, 5], // Falafel frittiert (USDA)
    salat: [22, 4, 1.2, 0.2, 2],        // Weißkohl, Tomate, Gurke, Zwiebel, Rotkohl
    pommes: [290, 37, 3.5, 14.5, 3.5],  // Pommes frites frittiert (nach McDonald's-Portion 114 g / 329 kcal)
    reis: [140, 29, 2.7, 1.5, 0.5],     // Reis gekocht mit etwas Öl
    bulgur: [120, 22, 3.5, 2, 3.5],     // Bulgurpilaw
    ketchup: [100, 24, 1.5, 0.1, 0.5],
    mayo: [680, 2, 1, 75, 0],
    kraeuter: [130, 5, 3, 10.5, 0],     // Kräutersoße (Joghurt/Mayo; fddb Imbiss 80, Handel bis 330)
    knoblauch: [165, 5, 2.5, 14.5, 0],
    kaese: [356, 0, 25, 28, 0],         // Gouda/Schafskäse-Ersatz im Döner (foods.js Gouda)
    scharf: [100, 7, 1, 8, 0.5],
    cocktail: [250, 10, 1, 22.5, 0],
    joghurt: [70, 4, 3.5, 4.5, 0],
    // Pizza je 100 g (gebacken, Pizzeria/Steinofen). Quellen streuen stark (174 bis 285 kcal, meist Nutzereinträge):
    // Margherita fddb 240/32.9/8.9/7.6, Funghi fddb 237/30.4/11.6/7.8, Quattro Formaggi fddb 243/23.2/11.1/11.3, Salami Handel ca. 265.
    // Gewählt wurde jeweils ein mittlerer Wert, Beläge als Aufschlag auf Margherita.
    pz_marg: [245, 32, 9.5, 8.5, 2],
    pz_sal: [265, 29, 11.5, 12, 2],
    pz_schi: [250, 30, 11.5, 8.5, 2],
    pz_fung: [237, 30, 10.5, 7.8, 2],
    pz_prosc: [245, 29.5, 11.5, 8.5, 2],
    pz_tonno: [235, 27, 12.5, 8, 2],
    pz_haw: [240, 30, 10, 8.5, 2],
    pz_diav: [270, 29, 11.5, 12.5, 2],
    pz_4f: [265, 27, 12, 12.5, 1.8],
    pz_veg: [215, 30, 8, 6.5, 2.5],
    // Weitere Imbiss-Bausteine
    gyros: [205, 1, 17, 15, 0],         // Gyros (Schwein) gebraten, wikifit 203/1/17/15
    tzatziki: [115, 4, 3.5, 9.5, 0.5],  // Tzatziki, Handelsdurchschnitt
    lahm: [230, 33, 9.5, 7, 2],         // Lahmacun, Yazio 226/35.5/8.8/4.8, Fett nach Hackfleisch und Öl angehoben
    cwurst: [290, 2, 12, 26, 0],        // Currywurst (Brüh-/Bratwurst)
    cs: [95, 20, 1.5, 0.5, 1],          // Currysoße (Ketchup-Basis mit Currypulver)
    semmel: [270, 53, 9, 1.5, 3],       // Brötchen
    bolo: [150, 18, 7.5, 5, 1.5],       // Spaghetti Bolognese, Gericht (fddb 135/13.3/8.4/5.3, Rechnung aus 250 g Nudeln und 150 g Soße 153)
    carb: [205, 18.5, 5.5, 10.5, 1.2],  // Spaghetti Carbonara (wikifit 208/18.6/5.1/10.6)
    napoli: [125, 23, 4.5, 2, 1.8],     // Spaghetti Napoli, aus Bausteinen gerechnet
    lasagne: [145, 13.5, 7.5, 7, 1],    // Lasagne (Bechamel, Hackfleisch)
    // McDonald's Deutschland (je Portion umgerechnet auf 100 g)
    mc_ham: [240, 28, 12, 8, 2],            // Hamburger 106 g: 254 kcal, 29.7 C, 12.7 P, 8.5 F (Yazio)
    mc_chs: [254, 26, 13, 10, 1.6],         // Cheeseburger 120 g: 305 kcal, 31.2 C, 15.6 P, 12 F (Yazio)
    mc_chk: [263, 28, 10, 12, 2],           // McChicken 177 g: 466 kcal, 49.6 C, 17.7 P, 21.2 F (Yazio)
    bk_wh: [219, 17, 9.9, 12.3, 1.4],       // Whopper 275 g: 597 bis 608 kcal, 46.8 C, 26.7 bis 27.5 P, 31.9 bis 35.8 F (Yazio, wikifit); fddb 287 g war unbestätigt
    bk_cc: [285, 22, 9.2, 17.5, 1.5],       // Crispy Chicken 183 g: 522 kcal, 40.4 C, 16.8 P, 32 F (Yazio)
    mc_big: [232, 19, 12, 12, 1.4],         // Big Mac 221 g: 513 kcal, 42 C, 26.5 P, 26.5 F, 3.1 Ballaststoffe (Yazio)
    mc_nug: [245, 16.5, 14.7, 12.8, 1],     // McNuggets 109 g: 267 kcal, 18 C, 16 P, 14 F
    mc_fri: [289, 36, 3.4, 14, 3.5]         // Pommes mittel 114 g: 329 kcal, 41 C, 3.9 P, 16 F
  };
  var SOS = [['0', 'Ohne Soße'], ['kraeuter', 'Kräutersoße'], ['knoblauch', 'Knoblauchsoße'], ['scharf', 'Scharfe Soße'], ['cocktail', 'Cocktailsoße'], ['joghurt', 'Joghurtsoße'],
    ['kraeuter+scharf', 'Kräuter + scharf'], ['knoblauch+scharf', 'Knoblauch + scharf'], ['kraeuter+knoblauch+scharf', 'Alles (Kräuter, Knoblauch, scharf)']];
  var SOSG = [['0.5', 'wenig, 20 g'], ['1', 'normal, 40 g'], ['1.75', 'viel, 70 g']];
  var SIZES = [['s', 'Klein'], ['m', 'Normal'], ['l', 'Groß']];
  var PSIZE = [['26', 'Ø 26 cm (ca. 330 g)'], ['30', 'Ø 30 cm (ca. 440 g)'], ['32', 'Ø 32 cm (ca. 500 g)'], ['36', 'Ø 36 cm, Jumbo (ca. 635 g)']];
  var PGRAM = { '26': 330, '30': 440, '32': 500, '36': 635 };
  var PIZ = [['marg', 'Margherita'], ['sal', 'Salami'], ['schi', 'Schinken'], ['fung', 'Funghi (Champignons)'], ['prosc', 'Prosciutto e Funghi (Schinken, Champignons)'], ['4f', 'Quattro Formaggi (4 Käse)'], ['veg', 'Vegetaria (Gemüse)'], ['tonno', 'Tonno (Thunfisch, Zwiebeln)'], ['haw', 'Hawaii (Schinken, Ananas)'], ['diav', 'Diavola (scharfe Salami)']];

  function pick(a, k) { return a[{ s: 0, m: 1, l: 2 }[k]]; }
  function sauceParts(o, parts) {
    var g = 40 * (+o.sg || 1), ids = String(o.sauce || '0').split('+');
    if (ids[0] === '0') return;
    ids.forEach(function (id) { parts.push([id, g / ids.length]); });
  }
  function meat(o) { return o.meat === 'huhn' ? 'huhn' : 'kalb'; }
  function meatName(o) { return o.meat === 'huhn' ? 'Hähnchen' : 'Kalb/Rind'; }
  function lbl(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === String(v)) return list[i][1]; return ''; }
  function sosName(o) { return o.sauce && o.sauce !== '0' ? lbl(SOS, o.sauce) : 'ohne Soße'; }
  function salatPart(o, g) { return o.salat === '0' ? [] : [['salat', g]]; }
  var MEAT = { l: 'Fleisch', c: [['kalb', 'Kalb/Rind'], ['huhn', 'Hähnchen']] };
  function sel(id, l, c, d) { return { id: id, l: l, c: c, d: d }; }

  var dishes = [
    { id: 'doener', n: 'Döner Kebab (Tasche)', kw: 'döner doener kebab kebap imbiss',
      opts: [sel('size', 'Größe', SIZES, 'm'), sel('meat', 'Fleisch', MEAT.c, 'kalb'), sel('sauce', 'Soße', SOS, 'knoblauch'), sel('sg', 'Soßenmenge', SOSG, '1'), sel('salat', 'Salat und Zwiebeln', [['1', 'mit'], ['0', 'ohne']], '1'), sel('kaese', 'Käse', [['0', 'ohne'], ['1', 'mit Käse']], '0')],
      build: function (o) { var p = [['brot', pick([100, 130, 160], o.size)], [meat(o), pick([80, 110, 150], o.size)]].concat(salatPart(o, pick([60, 80, 100], o.size))); sauceParts(o, p); if (o.kaese === '1') p.push(['kaese', 20]);
        return { p: p, name: 'Döner Kebab, ' + lbl(SIZES, o.size).toLowerCase() + ', ' + meatName(o) + ', ' + sosName(o) + (o.kaese === '1' ? ', mit Käse' : '') }; } },
    { id: 'dueruem', n: 'Dürüm Döner', kw: 'dürüm dueruem durum doener döner kebab wrap yufka imbiss',
      opts: [sel('size', 'Größe', SIZES, 'm'), sel('meat', 'Fleisch', MEAT.c, 'kalb'), sel('sauce', 'Soße', SOS, 'knoblauch'), sel('sg', 'Soßenmenge', SOSG, '1'), sel('salat', 'Salat und Zwiebeln', [['1', 'mit'], ['0', 'ohne']], '1'), sel('kaese', 'Käse', [['0', 'ohne'], ['1', 'mit Käse']], '0')],
      build: function (o) { var p = [['yufka', pick([80, 100, 125], o.size)], [meat(o), pick([80, 110, 150], o.size)]].concat(salatPart(o, pick([60, 80, 100], o.size))); sauceParts(o, p); if (o.kaese === '1') p.push(['kaese', 20]);
        return { p: p, name: 'Dürüm Döner, ' + lbl(SIZES, o.size).toLowerCase() + ', ' + meatName(o) + ', ' + sosName(o) + (o.kaese === '1' ? ', mit Käse' : '') }; } },
    { id: 'teller', n: 'Döner Teller', kw: 'döner doener teller kebab imbiss pommes reis',
      opts: [sel('size', 'Größe', SIZES, 'm'), sel('meat', 'Fleisch', MEAT.c, 'kalb'), sel('side', 'Beilage', [['pommes', 'Pommes'], ['reis', 'Reis'], ['bulgur', 'Bulgur']], 'pommes'), sel('sauce', 'Soße', SOS, 'knoblauch'), sel('sg', 'Soßenmenge', SOSG, '1')],
      build: function (o) { var side = o.side || 'pommes', p = [[meat(o), pick([120, 160, 220], o.size)], [side, pick([150, 220, 300], o.size)], ['salat', pick([80, 100, 120], o.size)]]; sauceParts(o, p);
        return { p: p, name: 'Döner Teller, ' + lbl(SIZES, o.size).toLowerCase() + ', ' + meatName(o) + ' mit ' + lbl([['pommes', 'Pommes'], ['reis', 'Reis'], ['bulgur', 'Bulgur']], side) + ', ' + sosName(o) }; } },
    { id: 'falafel', n: 'Falafel-Tasche', kw: 'falafel tasche vegetarisch döner doener imbiss',
      opts: [sel('size', 'Größe', [['s', 'Klein (4 Stück)'], ['m', 'Normal (6 Stück)'], ['l', 'Groß (8 Stück)']], 'm'), sel('sauce', 'Soße', SOS, 'knoblauch'), sel('sg', 'Soßenmenge', SOSG, '1'), sel('salat', 'Salat und Zwiebeln', [['1', 'mit'], ['0', 'ohne']], '1')],
      build: function (o) { var p = [['brot', pick([100, 130, 160], o.size)], ['falafel', pick([70, 105, 140], o.size)]].concat(salatPart(o, pick([60, 80, 100], o.size))); sauceParts(o, p);
        return { p: p, name: 'Falafel-Tasche, ' + pick([4, 6, 8], o.size) + ' Stück, ' + sosName(o) }; } },
    { id: 'falafelduerum', n: 'Falafel-Dürüm', kw: 'falafel dürüm dueruem durum wrap vegetarisch imbiss',
      opts: [sel('size', 'Größe', [['s', 'Klein (4 Stück)'], ['m', 'Normal (6 Stück)'], ['l', 'Groß (8 Stück)']], 'm'), sel('sauce', 'Soße', SOS, 'knoblauch'), sel('sg', 'Soßenmenge', SOSG, '1'), sel('salat', 'Salat und Zwiebeln', [['1', 'mit'], ['0', 'ohne']], '1')],
      build: function (o) { var p = [['yufka', pick([80, 100, 125], o.size)], ['falafel', pick([70, 105, 140], o.size)]].concat(salatPart(o, pick([60, 80, 100], o.size))); sauceParts(o, p);
        return { p: p, name: 'Falafel-Dürüm, ' + pick([4, 6, 8], o.size) + ' Stück, ' + sosName(o) }; } },
    { id: 'pizza', n: 'Pizza (Pizzeria)', kw: 'pizza margherita margarita salami schinken funghi prosciutto quattro formaggi vegetaria tonno hawaii diavola pizzeria restaurant',
      opts: [sel('sort', 'Sorte', PIZ, 'marg'), sel('size', 'Größe', PSIZE, '30'), sel('part', 'Wie viel davon', [['1', 'ganze Pizza'], ['0.5', 'halbe Pizza'], ['0.25', 'Viertel (2 Stücke)']], '1')],
      build: function (o) { var s = o.sort || 'marg', pt = +o.part || 1; return { p: [['pz_' + s, Math.round((PGRAM[o.size || '30'] || 440) * pt)]], name: (pt < 1 ? (pt === 0.5 ? 'Halbe ' : 'Viertel ') : '') + 'Pizza ' + lbl(PIZ, s).replace(/ \(.*\)/, '') + ', Ø ' + (o.size || '30') + ' cm' }; } },
    { id: 'gyrospita', n: 'Gyros-Pita', kw: 'gyros pita tasche fladenbrot griechisch tzatziki imbiss',
      opts: [sel('size', 'Größe', SIZES, 'm'), sel('pom', 'Pommes in der Pita', [['0', 'ohne'], ['1', 'mit Pommes']], '0'), sel('tz', 'Tzatziki', [['1', 'mit'], ['0', 'ohne']], '1')],
      build: function (o) { var p = [['brot', pick([90, 110, 130], o.size)], ['gyros', pick([100, 130, 170], o.size)], ['salat', pick([50, 70, 90], o.size)]]; if (o.tz !== '0') p.push(['tzatziki', pick([30, 40, 55], o.size)]); if (o.pom === '1') p.push(['pommes', pick([60, 80, 110], o.size)]);
        return { p: p, name: 'Gyros-Pita, ' + lbl(SIZES, o.size).toLowerCase() + (o.pom === '1' ? ' mit Pommes' : '') + (o.tz === '0' ? ', ohne Tzatziki' : ', Tzatziki') }; } },
    { id: 'gyrosteller', n: 'Gyros-Teller', kw: 'gyros teller griechisch tzatziki pommes reis imbiss',
      opts: [sel('size', 'Größe', SIZES, 'm'), sel('side', 'Beilage', [['pommes', 'Pommes'], ['reis', 'Reis'], ['bulgur', 'Bulgur']], 'pommes'), sel('tz', 'Tzatziki', [['1', 'mit'], ['0', 'ohne']], '1')],
      build: function (o) { var side = o.side || 'pommes', p = [['gyros', pick([140, 190, 250], o.size)], [side, pick([150, 220, 300], o.size)], ['salat', pick([80, 100, 120], o.size)]]; if (o.tz !== '0') p.push(['tzatziki', pick([40, 60, 80], o.size)]);
        return { p: p, name: 'Gyros-Teller, ' + lbl(SIZES, o.size).toLowerCase() + ' mit ' + lbl([['pommes', 'Pommes'], ['reis', 'Reis'], ['bulgur', 'Bulgur']], side) + (o.tz === '0' ? ', ohne Tzatziki' : ', Tzatziki') }; } },
    { id: 'lahmacun', n: 'Lahmacun (türkische Pizza)', kw: 'lahmacun lahmajun türkische pizza imbiss',
      opts: [sel('size', 'Größe', [['s', 'Klein (ca. 150 g)'], ['m', 'Normal (ca. 200 g)'], ['l', 'Groß (ca. 260 g)']], 'm'), sel('roll', 'Gerollt mit Salat', [['1', 'mit Salat und Soße'], ['0', 'pur']], '1'), sel('sauce', 'Soße', SOS, 'knoblauch')],
      build: function (o) { var p = [['lahm', pick([150, 200, 260], o.size)]]; if (o.roll !== '0') { p.push(['salat', pick([40, 60, 80], o.size)]); sauceParts({ sauce: o.sauce, sg: '0.5' }, p); }
        return { p: p, name: 'Lahmacun, ' + pick([150, 200, 260], o.size) + ' g' + (o.roll === '0' ? ' pur' : ', ' + sosName(o)) }; } },
    { id: 'currywurst', n: 'Currywurst', kw: 'currywurst curry wurst pommes imbiss bratwurst',
      opts: [sel('size', 'Größe', [['s', 'Klein (Wurst 120 g)'], ['m', 'Normal (Wurst 150 g)'], ['l', 'Groß (Wurst 200 g)']], 'm'), sel('side', 'Beilage', [['0', 'ohne'], ['pommes', 'Pommes'], ['semmel', 'Brötchen']], 'pommes'), sel('mayo', 'Mayo dazu', [['0', 'ohne'], ['1', 'mit (rot-weiß)']], '0')],
      build: function (o) { var side = o.side === undefined ? 'pommes' : o.side, p = [['cwurst', pick([120, 150, 200], o.size)], ['cs', pick([50, 60, 80], o.size)]]; if (side === 'pommes') p.push(['pommes', pick([150, 250, 350], o.size)]); else if (side === 'semmel') p.push(['semmel', pick([55, 55, 110], o.size)]); if (o.mayo === '1') p.push(['mayo', 25]);
        return { p: p, name: 'Currywurst, ' + lbl(SIZES, o.size).toLowerCase() + (side === 'pommes' ? ' mit Pommes' : side === 'semmel' ? ' mit Brötchen' : '') + (o.mayo === '1' ? ', mit Mayo' : '') }; } },
    { id: 'pasta', n: 'Pasta und Lasagne (Restaurant)', kw: 'pasta nudeln spaghetti bolognese carbonara napoli tomatensoße lasagne restaurant italiener',
      opts: [sel('sort', 'Gericht', [['bolo', 'Spaghetti Bolognese'], ['carb', 'Spaghetti Carbonara'], ['napoli', 'Spaghetti Napoli (Tomatensoße)'], ['lasagne', 'Lasagne']], 'bolo'), sel('size', 'Größe', [['s', 'Klein (350 g)'], ['m', 'Normal (450 g)'], ['l', 'Groß (550 g)']], 'm')],
      build: function (o) { var so = o.sort || 'bolo', g = pick([350, 450, 550], o.size); return { p: [[so, g]], name: lbl([['bolo', 'Spaghetti Bolognese'], ['carb', 'Spaghetti Carbonara'], ['napoli', 'Spaghetti Napoli'], ['lasagne', 'Lasagne']], so) + ', ' + g + ' g' }; } },
    { id: 'pommes', n: 'Pommes frites (Imbiss)', kw: 'pommes frites imbiss fritten fastfood',
      opts: [sel('size', 'Größe', [['s', 'Klein (150 g)'], ['m', 'Normal (250 g)'], ['l', 'Groß (350 g)']], 'm'), sel('dip', 'Soße', [['0', 'Ohne'], ['ketchup', 'Ketchup'], ['mayo', 'Mayo'], ['ketchup+mayo', 'Ketchup + Mayo (rot-weiß)']], '0')],
      build: function (o) { var p = [['pommes', pick([150, 250, 350], o.size)]], ids = String(o.dip || '0').split('+'); if (ids[0] !== '0') ids.forEach(function (id) { p.push([id, 25 / ids.length]); });
        return { p: p, name: 'Pommes frites, ' + lbl([['s', 'klein'], ['m', 'normal'], ['l', 'groß']], o.size || 'm') + (ids[0] !== '0' ? ', ' + lbl([['ketchup', 'Ketchup'], ['mayo', 'Mayo'], ['ketchup+mayo', 'Ketchup + Mayo']], o.dip) : '') }; } },
    { id: 'bigmac', n: 'Big Mac (McDonald\'s)', kw: 'big mac burger mcdonalds fastfood',
      opts: [sel('n', 'Anzahl', [['1', '1'], ['2', '2']], '1')],
      build: function (o) { return { p: [['mc_big', 221 * (+o.n || 1)]], name: (+o.n > 1 ? o.n + ' × ' : '') + 'Big Mac' }; } },
    { id: 'mcburger', n: 'Hamburger, Cheeseburger, McChicken (McDonald\'s)', kw: 'hamburger cheeseburger mcchicken chicken burger mcdonalds fastfood',
      opts: [sel('sort', 'Burger', [['ham', 'Hamburger (106 g)'], ['chs', 'Cheeseburger (120 g)'], ['chk', 'McChicken (177 g)']], 'chs'), sel('n', 'Anzahl', [['1', '1'], ['2', '2'], ['3', '3']], '1')],
      build: function (o) { var so = o.sort || 'chs', n = +o.n || 1, G = { ham: 106, chs: 120, chk: 177 }, N = { ham: 'Hamburger', chs: 'Cheeseburger', chk: 'McChicken' }; return { p: [['mc_' + so, G[so] * n]], name: (n > 1 ? n + ' × ' : '') + N[so] + ' (McDonald\'s)' }; } },
    { id: 'bkburger', n: 'Whopper, Crispy Chicken (Burger King)', kw: 'whopper crispy chicken burger king burgerking fastfood',
      opts: [sel('sort', 'Burger', [['wh', 'Whopper (275 g)'], ['cc', 'Crispy Chicken (183 g)']], 'wh'), sel('n', 'Anzahl', [['1', '1'], ['2', '2']], '1')],
      build: function (o) { var so = o.sort || 'wh', n = +o.n || 1, G = { wh: 275, cc: 183 }, N = { wh: 'Whopper', cc: 'Crispy Chicken' }; return { p: [['bk_' + so, G[so] * n]], name: (n > 1 ? n + ' × ' : '') + N[so] + ' (Burger King)' }; } },
    { id: 'nuggets', n: 'Chicken McNuggets (McDonald\'s)', kw: 'chicken mcnuggets nuggets mcdonalds fastfood',
      opts: [sel('n', 'Stückzahl', [['6', '6 Stück'], ['9', '9 Stück'], ['20', '20 Stück']], '6')],
      build: function (o) { var n = +o.n || 6; return { p: [['mc_nug', 18.2 * n]], name: n + ' Chicken McNuggets' }; } },
    { id: 'mcpommes', n: 'Pommes (McDonald\'s)', kw: 'pommes frites mcdonalds fastfood',
      opts: [sel('size', 'Größe', [['s', 'Klein (ca. 80 g)'], ['m', 'Mittel (114 g)'], ['l', 'Groß (ca. 150 g)']], 'm')],
      build: function (o) { return { p: [['mc_fri', pick([80, 114, 150], o.size)]], name: 'McDonald\'s Pommes, ' + lbl([['s', 'klein'], ['m', 'mittel'], ['l', 'groß']], o.size || 'm') }; } }
  ];

  function opts(d, o) { var r = {}; d.opts.forEach(function (x) { r[x.id] = (o && o[x.id] !== undefined) ? o[x.id] : x.d; }); return r; }
  /* Rechnet ein Gericht in ein Lebensmittel um (Werte je 100 g), das die App wie jedes andere verbucht. */
  function build(id, o) {
    var d = null; dishes.forEach(function (x) { if (x.id === id) d = x; });
    if (!d) return null;
    o = opts(d, o);
    var r = d.build(o), g = 0, k = 0, c = 0, p = 0, f = 0, fi = 0;
    r.p.forEach(function (x) {
      var ids = String(x[0]).split('+'); // Einzelbausteine
      var a = C[x[0]]; if (!a) return;
      g += x[1]; k += a[0] * x[1] / 100; c += a[1] * x[1] / 100; p += a[2] * x[1] / 100; f += a[3] * x[1] / 100; fi += a[4] * x[1] / 100;
    });
    g = Math.round(g);
    return { n: r.name, k: k / g * 100, c: c / g * 100, p: p / g * 100, f: f / g * 100, fi: fi / g * 100, gr: '', co: '', v: '', pn: 'Portion', pg: g,
      dish: { id: id, o: o }, total: { g: g, k: k, c: c, p: p, f: f, fi: fi } };
  }
  window.IMBISS = { dishes: dishes, build: build, opts: opts };
})();
