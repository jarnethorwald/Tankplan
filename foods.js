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
