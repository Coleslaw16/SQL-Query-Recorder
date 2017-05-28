$(function () {
    var $results = $("div.results");
    var $h3 = $("h3");
    var $query = $("textarea");
    var questions = JSON.parse(sessionStorage.getItem("listOfQuestion"));
    var questionsIndex = JSON.parse(sessionStorage.getItem("qindex"));
    var $questionLabel = $("#questionLabel");
    var $userName = $("#userID");
    var $submitButton = $(".send");

    $submitButton.on('click', function (event) {
        questions.splice(questionsIndex, 1);
        if (questions.length > 0) {
            questionsIndex--;
            backForwardReset("forward");
        }
        else {
            $('#myModal').modal('show');
        }
        var questionsTemp = []
        for (var i = 0; i < questions.length; i++) {
            questionsTemp.push(questions[i][0]);
        }
        console.log(questionsTemp);
        $.post("/questions", { questionList: JSON.stringify(questionsTemp) }, function (data) {

        })
            .done(function () {
                //backForwardReset("forward");
            })
            .fail(function () {
                alert("We could not save you data");
            })
    });

    $(".logout").on('click', function (event) {
        $.get("/logout", function (data) {

        })
            .always(function (data) {
                window.location.href = data.redirect
            });
    });

    function backForwardReset(direction) {
        if (direction === "forward") {
            questionsIndex += 1;
            if (questionsIndex >= questions.length) {
                questionsIndex = 0;
            }
        } else if (direction === "backward") {
            questionsIndex -= 1;
            if (questionsIndex <= -1) {
                questionsIndex = questions.length - 1;
            }
        }
        $results.removeClass("alert alert-warning alert-danger");
        updateQuestionAnswer();
        updateLabel();
        $submitButton.addClass("buttonHide");
        $results.html("");
    }

    function updateLabel() {
        $questionLabel.text("(" + (questionsIndex + 1) + "/" + questions.length + ")");
    }

    function updateQuestionAnswer() {
        $h3.text(questions[questionsIndex][0]);
        $query.val(questions[questionsIndex][1]);
    }

    $query.focus(function (event) {
        $submitButton.addClass("buttonHide");
    });

    $("form").on("submit", function (event) {
        event.preventDefault();
        $results.removeClass("alert alert-warning alert-danger");
        var queryString = $.trim($query.val())
        questions[questionsIndex][1] = queryString;
        $results.html("Getting Results....");
        $submitButton.removeClass("buttonHide");
        queryString = queryString.replace(/\s+/g, " ")
        var request = $.ajax({
            url: "/app?sql=" + queryString + "&userName=" + $userName.text() + "&question=" + $h3.text(),
            dataType: "json"
        })
            .done(function (data) {
                console.log(data);
                if (!data.success === false) {
                    data = data.data;
                    if (data.length === 0) {
                        $results.addClass("alert alert-warning");
                        $results.text("No results");
                    } else {
                        var htmlTables = "<table class=\"table table-striped\"> <tr>";
                        var keys = Object.keys(data[0]);
                        for (var j = 0; j < keys.length; j++) {
                            htmlTables += "<th>" + keys[j] + "</th>";
                        }
                        htmlTables += "</tr>";
                        for (var i = 0; i < data.length; i++) {
                            object = data[i];

                            htmlTables += "<tr>"
                            for (var j = 0; j < keys.length; j++) {
                                htmlTables += "<td>" + object[keys[j]] + "</td>";
                            }
                            htmlTables += "</tr>";
                        }
                        htmlTables += "</tables>"
                        $results.html(htmlTables);
                    }
                }
                else {
                    $results.addClass("alert alert-danger");
                    $results.text(data.data);
                }
            })
            .fail(function () {
                $results.html("Error!");
            });
    });

    $("#nextButton").on("click", function (event) {
        backForwardReset("forward");
    });

    $("#backButton").on("click", function (event) {
        backForwardReset("backward");
    });


    if (!questions) {
        var questions_results = $.ajax({
            url: "/questions",
            dataType: "json"
        })
            .done(function (data) {
                if (data.data.length == 0) {
                    $('#myModal').modal('show');
                }
                questions = [];
                questionsIndex = 0;
                data = data.data;
                for (var i = 0; i < data.length; i++) {
                    questions.push([data[i], "Please enter a query"]);
                }
                updateQuestionAnswer();
                updateLabel();
            })
            .fail(function () {
                $h3.text("Error getting question");
            });
    } else {
        updateQuestionAnswer()
        updateLabel();
    }

    $(window).on('beforeunload', function (e) {
        var textBoxValue = $query.val();
        if(!textBoxValue) {
            textBoxValue = "";
        }
        questions[questionsIndex][1] = $query.val();
        //console.log(questions[questionsIndex][1]);
        sessionStorage.setItem("listOfQuestion", JSON.stringify(questions));
        sessionStorage.setItem("qindex", JSON.stringify(questionsIndex));
    });
});